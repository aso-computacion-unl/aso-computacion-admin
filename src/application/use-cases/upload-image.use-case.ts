import { assertImageMimeType, assertImageMinWidth, assertImageSize } from "@/domain/image";

import type { ImageUploadFile, MediaStoragePort, UploadResult } from "../ports/media-storage.port";

export interface UploadImageInput {
  readonly file: ImageUploadFile;
  readonly folder: string;
  /** Smallest acceptable width in px; each caller decides (events 1200, board smaller). */
  readonly minWidth: number;
}

/**
 * Generic, entity-agnostic image upload shared by every feature that stores
 * photos.
 *
 * Dimensions: the width is NOT read from the file header. Cloudinary decodes
 * the image and reports the real width, so the use case uploads first, checks
 * that width, and destroys the asset when it is below the caller's minimum.
 * That avoids shipping three header parsers (JPEG/PNG/WebP) for an admin-only
 * flow, at the cost of a transient upload for a rejected image. A rejected
 * image therefore never stays in storage; if the cleanup itself fails the
 * error is surfaced (not swallowed) so the orphan is visible in the logs.
 *
 * Retention: nothing is ever deleted as a side effect of a successful upload
 * or of replacing an image elsewhere. Only the too-small rejection destroys.
 */
export class UploadImageUseCase {
  constructor(private readonly storage: MediaStoragePort) {}

  async execute({ file, folder, minWidth }: UploadImageInput): Promise<UploadResult> {
    assertImageMimeType(file.type);
    assertImageSize(file.size);

    const asset = await this.storage.upload(file, { folder });

    try {
      assertImageMinWidth(asset.width, minWidth);
    } catch (error) {
      await this.storage.destroy(asset.publicId);
      throw error;
    }

    return asset;
  }
}
