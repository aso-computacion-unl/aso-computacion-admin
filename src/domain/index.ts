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
export { EVENT_TYPES, Event } from "./event";
export type { CreateEventInput, EventProps, EventType, UpdateEventInput } from "./event";
export { EventPhoto, MAX_ACTIVE_EVENT_PHOTOS } from "./event-photo";
export type { CreateEventPhotoInput, EventPhotoProps } from "./event-photo";
export { assertSlug, slugify } from "./slug";
