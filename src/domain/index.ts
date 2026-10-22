/**
 * Domain layer entry point.
 *
 * This layer holds content entities and their invariants. It must stay
 * framework-independent: no imports from `next/*`, the Prisma client, the
 * Cloudinary SDK, or `jose` are allowed here. See
 * `src/tests/unit/architecture-boundaries.test.ts`.
 */
export {
  DomainError,
  ImageTooLargeError,
  ImageTooSmallError,
  InvalidImageFormatError,
  ValidationError,
} from "./domain-error";
export {
  IMAGE_MAX_SIZE_BYTES,
  IMAGE_MIME_TYPES,
  assertImageMimeType,
  assertImageMinWidth,
  assertImageSize,
} from "./image";
export type { ImageMimeType } from "./image";
