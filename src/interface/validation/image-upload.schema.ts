import { z } from "zod";

import { InvalidImageFormatError } from "@/domain/domain-error";
import { IMAGE_MAX_SIZE_BYTES, IMAGE_MIME_TYPES, type ImageMimeType } from "@/domain/image";

// Multipart form-data framing (boundary markers, per-part headers, field
// names) adds a small, roughly constant amount of overhead on top of the raw
// file bytes for a single-file upload. 64 KB comfortably covers that framing
// while still rejecting requests that are clearly larger than an allowed image.
const MULTIPART_OVERHEAD_BYTES = 64 * 1024;

export const MAX_IMAGE_UPLOAD_REQUEST_BYTES = IMAGE_MAX_SIZE_BYTES + MULTIPART_OVERHEAD_BYTES;

const supportedMimeTypes: readonly string[] = Object.values(IMAGE_MIME_TYPES);

const imageFileSchema = z
  .instanceof(File)
  .refine((file) => supportedMimeTypes.includes(file.type), {
    message: "Image MIME type must be JPEG, PNG, or WebP",
  })
  .refine((file) => file.size > 0, { message: "Image file must not be empty" })
  .refine((file) => file.size <= IMAGE_MAX_SIZE_BYTES, {
    message: "Image size must not exceed 5 MB",
  });

export const imageUploadSchema = z.preprocess(
  (input) => {
    if (!(input instanceof FormData)) {
      return input;
    }

    const files = input.getAll("file");

    if (files.length !== 1) {
      return { file: files[0], duplicateFile: true };
    }

    return Object.fromEntries(input.entries());
  },
  z.object({ file: imageFileSchema }).strict(),
);

const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const RIFF_ASCII = [0x52, 0x49, 0x46, 0x46];
const WEBP_ASCII = [0x57, 0x45, 0x42, 0x50];
const WEBP_ASCII_OFFSET = 8;

// Long enough to hold every declared signature window: the PNG signature (8
// bytes) and the RIFF/WEBP window (bytes 0-3 and 8-11).
const SIGNATURE_CHECK_BYTE_COUNT = 12;

function matchesBytesAt(bytes: Uint8Array, offset: number, expected: readonly number[]): boolean {
  if (bytes.length < offset + expected.length) {
    return false;
  }

  return expected.every((value, index) => bytes[offset + index] === value);
}

function matchesDeclaredSignature(bytes: Uint8Array, mimeType: string): boolean {
  switch (mimeType as ImageMimeType) {
    case IMAGE_MIME_TYPES.JPEG:
      return matchesBytesAt(bytes, 0, JPEG_SIGNATURE);
    case IMAGE_MIME_TYPES.PNG:
      return matchesBytesAt(bytes, 0, PNG_SIGNATURE);
    case IMAGE_MIME_TYPES.WEBP:
      return matchesBytesAt(bytes, 0, RIFF_ASCII) && matchesBytesAt(bytes, WEBP_ASCII_OFFSET, WEBP_ASCII);
    default:
      return false;
  }
}

/**
 * Verifies that a file's leading bytes match the true magic-number signature
 * for the format the client declared via `file.type`, rather than trusting
 * the declared MIME type alone. Rejects using the same domain error the
 * declaration-based check already maps to a stable 400 `INVALID_IMAGE_FORMAT`
 * response.
 */
export async function assertValidImageSignature(file: File): Promise<void> {
  const leadingBytes = new Uint8Array(await file.slice(0, SIGNATURE_CHECK_BYTE_COUNT).arrayBuffer());

  if (!matchesDeclaredSignature(leadingBytes, file.type)) {
    throw new InvalidImageFormatError("Image MIME type must be JPEG, PNG, or WebP");
  }
}
