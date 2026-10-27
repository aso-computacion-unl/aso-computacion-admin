export interface ImageUploadFile {
  readonly name: string;
  readonly type: string;
  readonly size: number;
  readonly arrayBuffer: () => Promise<ArrayBuffer>;
}

export interface UploadOptions {
  /** Subfolder chosen by the caller (e.g. "events"); the adapter owns the base folder. */
  readonly folder: string;
}

export interface UploadResult {
  readonly url: string;
  readonly publicId: string;
  readonly width: number;
  readonly height: number;
}

/**
 * What a destroy that the provider accepted came to. `not_found` means the file was already gone:
 * a caller that only wants it gone treats that as success, one that must know it removed the file
 * itself (the orphan cleanup, which audits the deletion) accepts only `deleted`.
 */
export type DestroyOutcome = "deleted" | "not_found";

export interface MediaStoragePort {
  upload(file: ImageUploadFile, options: UploadOptions): Promise<UploadResult>;
  destroy(publicId: string): Promise<DestroyOutcome>;
}
