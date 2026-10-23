import { describe, expect, it } from "vitest";

import { IMAGE_MAX_SIZE_BYTES } from "@/domain/image";
import { InvalidImageFormatError } from "@/domain";
import {
  MAX_IMAGE_UPLOAD_REQUEST_BYTES,
  assertValidImageSignature,
  imageUploadSchema,
} from "@/interface/validation/image-upload.schema";

const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0];
const WEBP = [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50];

function fileOf(bytes: number[], type: string): File {
  return new File([Uint8Array.from(bytes)], "x", { type });
}

function formOf(...files: File[]): FormData {
  const form = new FormData();
  files.forEach((file) => form.append("file", file));
  return form;
}

describe("imageUploadSchema", () => {
  it("accepts a single supported image", () => {
    const result = imageUploadSchema.safeParse(formOf(fileOf(JPEG, "image/jpeg")));

    expect(result.success).toBe(true);
  });

  it.each([
    ["unsupported MIME type", formOf(fileOf(JPEG, "image/gif"))],
    ["empty file", formOf(new File([], "x", { type: "image/png" }))],
    ["missing file", new FormData()],
    ["more than one file", formOf(fileOf(JPEG, "image/jpeg"), fileOf(JPEG, "image/jpeg"))],
  ])("rejects %s", (_label, form) => {
    expect(imageUploadSchema.safeParse(form).success).toBe(false);
  });

  it("rejects a file over 5 MB", () => {
    const big = new File([new Uint8Array(IMAGE_MAX_SIZE_BYTES + 1)], "x", { type: "image/png" });

    expect(imageUploadSchema.safeParse(formOf(big)).success).toBe(false);
  });

  it("allows request framing overhead on top of the 5 MB file ceiling", () => {
    expect(MAX_IMAGE_UPLOAD_REQUEST_BYTES).toBeGreaterThan(IMAGE_MAX_SIZE_BYTES);
  });
});

describe("assertValidImageSignature", () => {
  it.each([
    ["JPEG", JPEG, "image/jpeg"],
    ["PNG", PNG, "image/png"],
    ["WebP", WEBP, "image/webp"],
  ])("accepts a real %s signature", async (_label, bytes, type) => {
    await expect(assertValidImageSignature(fileOf(bytes, type))).resolves.toBeUndefined();
  });

  it.each([
    ["PNG bytes declared as JPEG", PNG, "image/jpeg"],
    ["JPEG bytes declared as WebP", JPEG, "image/webp"],
    ["RIFF without WEBP tag", [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45], "image/webp"],
    ["text declared as PNG", [0x3c, 0x73, 0x76, 0x67], "image/png"],
    ["truncated JPEG", [0xff, 0xd8], "image/jpeg"],
  ])("rejects %s", async (_label, bytes, type) => {
    await expect(assertValidImageSignature(fileOf(bytes, type))).rejects.toBeInstanceOf(InvalidImageFormatError);
  });
});
