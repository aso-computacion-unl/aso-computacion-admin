import { ImageTooLargeError, ImageTooSmallError, InvalidImageFormatError } from "./domain-error";

export const IMAGE_MIME_TYPES = {
  JPEG: "image/jpeg",
  PNG: "image/png",
  WEBP: "image/webp",
} as const;

export type ImageMimeType = (typeof IMAGE_MIME_TYPES)[keyof typeof IMAGE_MIME_TYPES];

export const IMAGE_MAX_SIZE_BYTES = 5 * 1024 * 1024;

export function assertImageMimeType(mimeType: string): asserts mimeType is ImageMimeType {
  if (!(Object.values(IMAGE_MIME_TYPES) as string[]).includes(mimeType)) {
    throw new InvalidImageFormatError("Image MIME type must be JPEG, PNG, or WebP");
  }
}

export function assertImageSize(byteSize: number): void {
  if (!Number.isInteger(byteSize) || byteSize <= 0) {
    throw new InvalidImageFormatError("Image file must not be empty");
  }

  if (byteSize > IMAGE_MAX_SIZE_BYTES) {
    throw new ImageTooLargeError("Image size must not exceed 5 MB");
  }
}

/**
 * The minimum width is deliberately a caller argument, not a constant: each
 * entity picks its own floor (event photos 1200 px, board photos a smaller
 * value), so the rule stays generic.
 */
export function assertImageMinWidth(width: number, minWidth: number): void {
  if (!Number.isInteger(minWidth) || minWidth <= 0) {
    throw new RangeError("minWidth must be a positive integer.");
  }

  if (width < minWidth) {
    throw new ImageTooSmallError(minWidth, width);
  }
}
