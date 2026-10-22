import { describe, expect, it } from "vitest";

import {
  DomainError,
  ImageTooLargeError,
  ImageTooSmallError,
  InvalidImageFormatError,
} from "@/domain";
import {
  IMAGE_MAX_SIZE_BYTES,
  IMAGE_MIME_TYPES,
  assertImageMimeType,
  assertImageMinWidth,
  assertImageSize,
} from "@/domain/image";

describe("image constraints", () => {
  it("allows only JPEG, PNG and WebP and caps files at 5 MB", () => {
    expect(Object.values(IMAGE_MIME_TYPES)).toEqual(["image/jpeg", "image/png", "image/webp"]);
    expect(IMAGE_MAX_SIZE_BYTES).toBe(5 * 1024 * 1024);
  });

  it.each(Object.values(IMAGE_MIME_TYPES))("accepts %s", (mimeType) => {
    expect(() => assertImageMimeType(mimeType)).not.toThrow();
  });

  it.each(["image/gif", "image/svg+xml", "application/pdf", ""])("rejects %j", (mimeType) => {
    expect(() => assertImageMimeType(mimeType)).toThrow(InvalidImageFormatError);
  });

  it("accepts a file of exactly the maximum size", () => {
    expect(() => assertImageSize(IMAGE_MAX_SIZE_BYTES)).not.toThrow();
  });

  it("rejects a file one byte over the maximum size", () => {
    expect(() => assertImageSize(IMAGE_MAX_SIZE_BYTES + 1)).toThrow(ImageTooLargeError);
  });

  it("rejects empty and non-integer sizes as an invalid format", () => {
    expect(() => assertImageSize(0)).toThrow(InvalidImageFormatError);
    expect(() => assertImageSize(1.5)).toThrow(InvalidImageFormatError);
  });
});

describe("image minimum width (caller-supplied)", () => {
  it("accepts a width equal to the minimum", () => {
    expect(() => assertImageMinWidth(1200, 1200)).not.toThrow();
  });

  it("rejects a 576 px story screenshot when the caller requires 1200 px", () => {
    expect(() => assertImageMinWidth(576, 1200)).toThrow(ImageTooSmallError);
  });

  it("accepts the same 576 px image when the caller requires a smaller width", () => {
    expect(() => assertImageMinWidth(576, 400)).not.toThrow();
  });

  it("carries the required and actual widths on the error", () => {
    try {
      assertImageMinWidth(576, 1200);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ImageTooSmallError);
      expect(error).toBeInstanceOf(DomainError);
      expect(error).toMatchObject({ minWidth: 1200, width: 576 });
    }
  });

  it.each([0, -1, 1.5, Number.NaN])("refuses a nonsensical minimum width of %s", (minWidth) => {
    expect(() => assertImageMinWidth(1200, minWidth)).toThrow(RangeError);
  });
});

describe("image domain errors", () => {
  it.each([new InvalidImageFormatError("x"), new ImageTooLargeError("x"), new ImageTooSmallError(1200, 576)])(
    "%s extends DomainError",
    (error) => {
      expect(error).toBeInstanceOf(DomainError);
    },
  );
});
