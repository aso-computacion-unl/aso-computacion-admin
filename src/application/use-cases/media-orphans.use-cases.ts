import { isManagedMediaFolder } from "../media-owners";
import type { MediaLibraryPort, MediaUsageReader, StoredAsset } from "../ports/media-library.port";
import type { MediaStoragePort } from "../ports/media-storage.port";

/**
 * An image is uploaded before the row that will own it is saved, so a young unused image may be
 * mid-upload, not abandoned. Nothing younger than this is offered for deletion, or deleted.
 */
export const ORPHAN_MIN_AGE_MS = 24 * 60 * 60 * 1000;

/** How many stored images one cleanup scan looks at (one call to the provider). */
export const ORPHAN_SCAN_PAGE_SIZE = 100;

/** The most images one deletion request may name. */
export const ORPHAN_DELETE_MAX = 50;

export interface OrphanCandidate extends StoredAsset {
  /** Old enough to delete. A younger one is listed so the person sees it, but cannot be chosen. */
  readonly deletable: boolean;
}

export interface OrphanScan {
  /** How many stored images this scan looked at. */
  readonly scanned: number;
  /** Of those, how many sit in a folder whose owners are not counted: left out, never offered. */
  readonly notManaged: number;
  readonly orphans: readonly OrphanCandidate[];
  readonly nextCursor: string | null;
}

const isOldEnough = (asset: StoredAsset, now: Date) => now.getTime() - asset.createdAt.getTime() >= ORPHAN_MIN_AGE_MS;

/**
 * Dry run: looks at one page of the storage and says which images no row points at. It deletes
 * nothing and has no way to: it is not given the destroy call. It fails closed: only the folders
 * whose owners the usage reader counts are looked at, so an image of any other kind of content
 * is never reported as unused just because nothing here counts it.
 */
export class FindOrphanImagesUseCase {
  constructor(
    private readonly library: MediaLibraryPort,
    private readonly usage: MediaUsageReader,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute({ cursor }: { cursor?: string } = {}): Promise<OrphanScan> {
    const page = await this.library.listAssets({ cursor, limit: ORPHAN_SCAN_PAGE_SIZE });
    const managed = page.assets.filter((asset) => isManagedMediaFolder(asset.folder));
    const usages = await this.usage.usagesOf(managed.map((asset) => asset.publicId));
    const now = this.now();
    const orphans = managed.filter((asset) => !usages.has(asset.publicId)).map((asset) => ({ ...asset, deletable: isOldEnough(asset, now) }));

    return { scanned: page.assets.length, notManaged: page.assets.length - managed.length, orphans, nextCursor: page.nextCursor };
  }
}

export type OrphanOutcome = "deleted" | "not_found" | "not_managed" | "too_recent" | "in_use" | "failed";

export interface OrphanDeletion {
  readonly publicId: string;
  readonly outcome: OrphanOutcome;
}

/**
 * Deletes the images a person chose from a dry run. The choice is not trusted: each image is
 * looked up again right before its file is destroyed and is skipped unless it still exists under
 * the app's folder, in a folder whose owners are counted, old enough and no row points at it. One failure never stops the rest.
 */
export class DeleteOrphanImagesUseCase {
  constructor(
    private readonly library: MediaLibraryPort,
    private readonly usage: MediaUsageReader,
    private readonly storage: MediaStoragePort,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute({ publicIds }: { publicIds: readonly string[] }): Promise<OrphanDeletion[]> {
    const results: OrphanDeletion[] = [];

    for (const publicId of publicIds) {
      results.push({ publicId, outcome: await this.deleteOne(publicId) });
    }

    return results;
  }

  private async deleteOne(publicId: string): Promise<OrphanOutcome> {
    try {
      const asset = await this.library.getAsset(publicId);

      if (!asset) return "not_found";
      if (!isManagedMediaFolder(asset.folder)) return "not_managed";
      if (!isOldEnough(asset, this.now())) return "too_recent";
      if ((await this.usage.usagesOf([publicId])).has(publicId)) return "in_use";

      await this.storage.destroy(publicId);
      return "deleted";
    } catch (error) {
      console.error(`Could not delete the unused image ${publicId}.`, error);
      return "failed";
    }
  }
}
