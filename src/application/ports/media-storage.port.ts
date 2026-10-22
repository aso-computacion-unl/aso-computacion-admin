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

export interface MediaStoragePort {
  upload(file: ImageUploadFile, options: UploadOptions): Promise<UploadResult>;
  destroy(publicId: string): Promise<void>;
}
