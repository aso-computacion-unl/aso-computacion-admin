/**
 * Application layer entry point.
 *
 * This layer holds use cases and ports (repositories, media storage) that
 * orchestrate domain behavior. It must stay framework-independent: no
 * imports from `next/*`, the Prisma client, the Cloudinary SDK, or `jose`
 * are allowed here. See `src/tests/unit/architecture-boundaries.test.ts`.
 */
export { NotFoundError } from "./use-cases/use-case-error";
export type {
  ImageUploadFile,
  MediaStoragePort,
  UploadOptions,
  UploadResult,
} from "./ports/media-storage.port";
export { UploadImageUseCase } from "./use-cases/upload-image.use-case";
export type { UploadImageInput } from "./use-cases/upload-image.use-case";
export type {
  EventDetailResult,
  EventListItemResult,
  EventPhotoResult,
  EventResult,
} from "./dto/event-result.dto";
export type { EventPhotoRepository } from "./ports/event-photo-repository.port";
export type { EventRepository } from "./ports/event-repository.port";
export {
  AttachEventPhotoUseCase,
  EVENT_PHOTO_FOLDER,
  EVENT_PHOTO_MIN_WIDTH,
} from "./use-cases/attach-event-photo.use-case";
export { CreateEventUseCase } from "./use-cases/create-event.use-case";
export { DeactivateEventPhotoUseCase } from "./use-cases/deactivate-event-photo.use-case";
export { DeleteEventUseCase } from "./use-cases/delete-event.use-case";
export { GetEventUseCase } from "./use-cases/get-event.use-case";
export { ListEventsUseCase } from "./use-cases/list-events.use-case";
export { ReorderEventPhotosUseCase } from "./use-cases/reorder-event-photos.use-case";
export { SetEventPublishedUseCase } from "./use-cases/set-event-published.use-case";
export { UpdateEventPhotoAltUseCase } from "./use-cases/update-event-photo-alt.use-case";
export { UpdateEventUseCase } from "./use-cases/update-event.use-case";
export type { FaqResult } from "./dto/faq-result.dto";
export type { OrderedContent, OrderedContentRepository } from "./ports/ordered-content-repository.port";
export {
  DeleteOrderedContentUseCase,
  GetOrderedContentUseCase,
  ListOrderedContentUseCase,
  MoveOrderedContentUseCase,
  SetOrderedContentPublishedUseCase,
  nextSortOrder,
} from "./use-cases/ordered-content.use-cases";
export { CreateFaqUseCase } from "./use-cases/create-faq.use-case";
export { UpdateFaqUseCase } from "./use-cases/update-faq.use-case";
export type { SocialLinkResult } from "./dto/social-link-result.dto";
export { CreateSocialLinkUseCase } from "./use-cases/create-social-link.use-case";
export { UpdateSocialLinkUseCase } from "./use-cases/update-social-link.use-case";
export type { PillarImageResult, PillarResult } from "./dto/pillar-result.dto";
export { CreatePillarUseCase } from "./use-cases/create-pillar.use-case";
export { DeletePillarUseCase } from "./use-cases/delete-pillar.use-case";
export { RemovePillarImageUseCase } from "./use-cases/remove-pillar-image.use-case";
export {
  PILLAR_IMAGE_FOLDER,
  PILLAR_IMAGE_MIN_WIDTH,
  SetPillarImageUseCase,
} from "./use-cases/set-pillar-image.use-case";
export { UpdatePillarUseCase } from "./use-cases/update-pillar.use-case";
export type { SiteSettingsResult } from "./dto/site-settings-result.dto";
export type { SiteSettingsRepository } from "./ports/site-settings-repository.port";
export { GetSiteSettingsUseCase } from "./use-cases/get-site-settings.use-case";
export { UpdateSiteSettingsUseCase } from "./use-cases/update-site-settings.use-case";
