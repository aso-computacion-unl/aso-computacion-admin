import { ValidationError } from "./domain-error";
import { httpsUrl, requiredText } from "./text";

export const STORED_IMAGE_ALT_MAX_LENGTH = 200;

/** A stored image plus the alt text the landing renders; the alt cannot exist without the image or vice versa. */
export interface StoredImage {
  readonly url: string;
  readonly publicId: string;
  readonly width: number;
  readonly height: number;
  readonly alt: string;
}

function positiveInteger(field: string, value: number): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new ValidationError(field, `${field} must be a positive integer`);
  }

  return value;
}

/** The alt of an image named `prefix` ("photo", "logo"); exposed so a caller can reject a bad alt before spending an upload on it. */
export function assertImageAlt(prefix: string, alt: string): string {
  return requiredText(`${prefix}Alt`, alt, STORED_IMAGE_ALT_MAX_LENGTH);
}

/** Validates every part of an image named `prefix`; errors name the field (`photoUrl`, `logoAlt`...). */
export function buildStoredImage(prefix: string, image: StoredImage): StoredImage {
  return {
    url: httpsUrl(`${prefix}Url`, image.url),
    publicId: requiredText(`${prefix}PublicId`, image.publicId, 255),
    width: positiveInteger(`${prefix}Width`, image.width),
    height: positiveInteger(`${prefix}Height`, image.height),
    alt: assertImageAlt(prefix, image.alt),
  };
}
