import "server-only";

import { requireRuntimeValue } from "@/infrastructure/config/runtime-env";

export const DEFAULT_CLOUDINARY_FOLDER = "aso-computacion";

// Slash-separated segments of letters, digits, `_` and `-`: no leading,
// trailing or doubled slashes and no `.`/`..`, so a folder can never escape
// the base folder.
const FOLDER_PATTERN = /^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/;

export function isValidCloudinaryFolder(folder: string): boolean {
  return FOLDER_PATTERN.test(folder);
}

export interface CloudinaryConfig {
  readonly cloudName: string;
  readonly apiKey: string;
  readonly apiSecret: string;
  /** Base folder every upload lives under; subfolders are chosen per caller. */
  readonly folder: string;
}

export class CloudinaryConfigError extends Error {
  constructor() {
    super("Cloudinary configuration is invalid.");
    this.name = "CloudinaryConfigError";
  }
}

export function getCloudinaryConfig(): CloudinaryConfig {
  const folder = process.env.CLOUDINARY_FOLDER?.trim() || DEFAULT_CLOUDINARY_FOLDER;

  if (!isValidCloudinaryFolder(folder)) {
    throw new CloudinaryConfigError();
  }

  try {
    return {
      cloudName: requireRuntimeValue("CLOUDINARY_CLOUD_NAME", process.env.CLOUDINARY_CLOUD_NAME),
      apiKey: requireRuntimeValue("CLOUDINARY_API_KEY", process.env.CLOUDINARY_API_KEY),
      apiSecret: requireRuntimeValue("CLOUDINARY_API_SECRET", process.env.CLOUDINARY_API_SECRET),
      folder,
    };
  } catch {
    throw new CloudinaryConfigError();
  }
}
