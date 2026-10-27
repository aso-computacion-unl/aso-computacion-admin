import type { MediaLibraryPort, MediaUsage, MediaUsageReader, StoredAsset } from "../ports/media-library.port";

export const MEDIA_PAGE_SIZE = 24;

export interface MediaLibraryItem extends StoredAsset {
  /** Empty when no row of the database points at the image. */
  readonly usedBy: readonly MediaUsage[];
}

export interface MediaLibraryPage {
  readonly items: readonly MediaLibraryItem[];
  readonly nextCursor: string | null;
}

/** One page of the stored images, each with the content that uses it. */
export class ListMediaLibraryUseCase {
  constructor(
    private readonly library: MediaLibraryPort,
    private readonly usage: MediaUsageReader,
  ) {}

  async execute({ cursor }: { cursor?: string } = {}): Promise<MediaLibraryPage> {
    const page = await this.library.listAssets({ cursor, limit: MEDIA_PAGE_SIZE });
    const usages = await this.usage.usagesOf(page.assets.map((asset) => asset.publicId));

    return { items: page.assets.map((asset) => ({ ...asset, usedBy: usages.get(asset.publicId) ?? [] })), nextCursor: page.nextCursor };
  }
}
