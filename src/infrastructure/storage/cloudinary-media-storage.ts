import "server-only";

import { v2 as cloudinary } from "cloudinary";

import type {
  ImageUploadFile,
  MediaStoragePort,
  UploadOptions,
  UploadResult,
} from "@/application/ports/media-storage.port";

import { getCloudinaryConfig, isValidCloudinaryFolder } from "./cloudinary-config";

const CLOUDINARY_DESTROY_OPTIONS = {
  resource_type: "image",
} as const;

export class CloudinaryMediaStorage implements MediaStoragePort {
  private readonly baseFolder: string;

  constructor() {
    const config = getCloudinaryConfig();

    this.baseFolder = config.folder;

    cloudinary.config({
      cloud_name: config.cloudName,
      api_key: config.apiKey,
      api_secret: config.apiSecret,
    });
  }

  async upload(file: ImageUploadFile, { folder }: UploadOptions): Promise<UploadResult> {
    if (!isValidCloudinaryFolder(folder)) {
      throw new Error("Invalid media folder.");
    }

    const uploadOptions = { resource_type: "image", folder: `${this.baseFolder}/${folder}` } as const;
    const buffer = Buffer.from(await file.arrayBuffer());

    return new Promise<UploadResult>((resolve, reject) => {
      let settled = false;
      let endReturned = false;
      let settleCallback: (() => void) | undefined;

      const rejectOnce = (error: Error) => {
        if (!settled) {
          settled = true;
          reject(error);
        }
      };

      const resolveOnce = (result: UploadResult) => {
        if (!settled) {
          settled = true;
          resolve(result);
        }
      };

      try {
        const stream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
          const settle = () => {
            if (error) {
              rejectOnce(error);
              return;
            }

            if (
              !result?.secure_url ||
              !result.public_id ||
              typeof result.width !== "number" ||
              typeof result.height !== "number"
            ) {
              rejectOnce(new Error("Cloudinary upload returned an incomplete result."));
              return;
            }

            resolveOnce({
              url: result.secure_url,
              publicId: result.public_id,
              width: result.width,
              height: result.height,
            });
          };

          if (endReturned) {
            settle();
            return;
          }

          settleCallback ??= settle;
        });

        stream.once("error", rejectOnce);
        stream.end(buffer);
        endReturned = true;
        settleCallback?.();
      } catch (error) {
        rejectOnce(error instanceof Error ? error : new Error("Cloudinary upload failed."));
      }
    });
  }

  async destroy(publicId: string): Promise<void> {
    await cloudinary.uploader.destroy(publicId, CLOUDINARY_DESTROY_OPTIONS);
  }
}
