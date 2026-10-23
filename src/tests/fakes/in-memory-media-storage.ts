import type {
  ImageUploadFile,
  MediaStoragePort,
  UploadOptions,
  UploadResult,
} from "@/application/ports/media-storage.port";

export interface StoredImage {
  readonly file: ImageUploadFile;
  readonly folder: string;
  readonly width: number;
  readonly height: number;
}

/**
 * Deterministic in-memory `MediaStoragePort`. It cannot decode images, so the
 * dimensions "reported by the provider" are supplied by the test through
 * `nextDimensions` (default 1600x1200).
 */
export class InMemoryMediaStorage implements MediaStoragePort {
  nextDimensions: { width: number; height: number } = { width: 1600, height: 1200 };
  destroyError: Error | undefined;

  readonly destroyedPublicIds: string[] = [];
  private readonly images = new Map<string, StoredImage>();

  async upload(file: ImageUploadFile, options: UploadOptions): Promise<UploadResult> {
    const publicId = `${options.folder}/${file.name}`;
    const { width, height } = this.nextDimensions;
    this.images.set(publicId, { file, folder: options.folder, width, height });

    return { url: `https://storage.test/${publicId}`, publicId, width, height };
  }

  async destroy(publicId: string): Promise<void> {
    if (this.destroyError) {
      throw this.destroyError;
    }

    this.destroyedPublicIds.push(publicId);
    this.images.delete(publicId);
  }

  has(publicId: string): boolean {
    return this.images.has(publicId);
  }

  get(publicId: string): StoredImage | undefined {
    return this.images.get(publicId);
  }

  get size(): number {
    return this.images.size;
  }
}
