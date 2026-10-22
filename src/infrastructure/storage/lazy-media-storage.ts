import "server-only";

import type { ImageUploadFile, MediaStoragePort, UploadOptions, UploadResult } from "@/application/ports/media-storage.port";

/**
 * Builds the real adapter on the first upload or destroy, not when a container is
 * created: pages that only read from the database must keep working when the
 * storage credentials are missing or invalid. A failed build is not cached, so a
 * fixed configuration takes effect on the next call.
 */
export class LazyMediaStorage implements MediaStoragePort {
  private inner: MediaStoragePort | undefined;

  constructor(private readonly factory: () => MediaStoragePort) {}

  upload(file: ImageUploadFile, options: UploadOptions): Promise<UploadResult> {
    return this.resolve().then((storage) => storage.upload(file, options));
  }

  destroy(publicId: string): Promise<void> {
    return this.resolve().then((storage) => storage.destroy(publicId));
  }

  private resolve(): Promise<MediaStoragePort> {
    try {
      this.inner ??= this.factory();
      return Promise.resolve(this.inner);
    } catch (error) {
      return Promise.reject(error);
    }
  }
}
