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
