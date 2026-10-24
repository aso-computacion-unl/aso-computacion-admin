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
export {
  COMMAND_NAME_MAX_LENGTH,
  COMMAND_NAME_MIN_LENGTH,
  CommandNameConflictError,
  RESERVED_COMMAND_NAMES,
  assertCommandName,
  optionalCommandName,
} from "./command-name";
export type { CommandNameConflict } from "./command-name";
export { Faq } from "./faq";
export type { CreateFaqInput, FaqProps, UpdateFaqInput } from "./faq";
export { SOCIAL_PLATFORMS, SocialLink } from "./social-link";
export type { CreateSocialLinkInput, SocialLinkProps, SocialPlatform, UpdateSocialLinkInput } from "./social-link";
export { Pillar } from "./pillar";
export type { CreatePillarInput, PillarImage, PillarProps, UpdatePillarInput } from "./pillar";
export { SITE_SETTINGS_ID, SiteSettings } from "./site-settings";
export type { SiteSettingsInput, SiteSettingsProps } from "./site-settings";
export { BoardMember } from "./board-member";
export type { BoardMemberPhoto, BoardMemberProps, CreateBoardMemberInput, UpdateBoardMemberInput } from "./board-member";
export { todayInEcuador } from "./calendar-date";
export { NewsItem } from "./news-item";
export type { CreateNewsItemInput, NewsCover, NewsItemProps, UpdateNewsItemInput } from "./news-item";
