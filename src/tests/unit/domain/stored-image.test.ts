import { describe, expect, it } from "vitest";

import { assertImageAlt, buildStoredImage, STORED_IMAGE_ALT_MAX_LENGTH, type StoredImage } from "@/domain/stored-image";

const image: StoredImage = { url: "https://res.cloudinary.com/aso/foto.webp", publicId: "aso/foto", width: 1200, height: 800, alt: "Foto del taller" };

describe("buildStoredImage", () => {
  it("keeps a valid image as it is", () => {
    expect(buildStoredImage("photo", image)).toEqual(image);
  });

  it("trims the text parts", () => {
    expect(buildStoredImage("photo", { ...image, publicId: " aso/foto ", alt: "  Foto del taller " })).toMatchObject({ publicId: "aso/foto", alt: "Foto del taller" });
  });

  it.each([
    ["Width", { width: 0 }],
    ["Width", { width: -5 }],
    ["Width", { width: 10.5 }],
    ["Width", { width: Number.NaN }],
    ["Height", { height: 0 }],
    ["Height", { height: 7.25 }],
  ])("refuses an invalid %s, naming the field with the prefix", (field, override) => {
    expect(() => buildStoredImage("logo", { ...image, ...override })).toThrow(expect.objectContaining({ name: "ValidationError", field: `logo${field}` }));
  });

  it("refuses an address that is not https, an empty public id and an empty alt", () => {
    expect(() => buildStoredImage("photo", { ...image, url: "http://example.com/x.webp" })).toThrow(expect.objectContaining({ field: "photoUrl" }));
    expect(() => buildStoredImage("photo", { ...image, publicId: "  " })).toThrow(expect.objectContaining({ field: "photoPublicId" }));
    expect(() => buildStoredImage("photo", { ...image, alt: "" })).toThrow(expect.objectContaining({ field: "photoAlt" }));
  });
});

describe("assertImageAlt", () => {
  it("accepts an alt up to the limit and names the field after the image", () => {
    expect(assertImageAlt("logo", "a".repeat(STORED_IMAGE_ALT_MAX_LENGTH))).toHaveLength(STORED_IMAGE_ALT_MAX_LENGTH);
    expect(() => assertImageAlt("logo", "a".repeat(STORED_IMAGE_ALT_MAX_LENGTH + 1))).toThrow(expect.objectContaining({ field: "logoAlt" }));
  });
});
