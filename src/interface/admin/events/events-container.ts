import {
  AttachEventPhotoUseCase,
  CreateEventUseCase,
  DeactivateEventPhotoUseCase,
  DeleteEventUseCase,
  GetEventUseCase,
  ListEventsUseCase,
  ReorderEventPhotosUseCase,
  SetEventPublishedUseCase,
  UpdateEventPhotoAltUseCase,
  UpdateEventUseCase,
  UploadImageUseCase,
} from "@/application";
import { EventPhotoPrismaRepository, EventPrismaRepository } from "@/infrastructure";
import { CloudinaryMediaStorage } from "@/infrastructure/storage/cloudinary-media-storage";

function createEventUseCases() {
  const events = new EventPrismaRepository();
  const photos = new EventPhotoPrismaRepository();
  const storage = new CloudinaryMediaStorage();

  return {
    list: new ListEventsUseCase(events, photos),
    get: new GetEventUseCase(events, photos),
    create: new CreateEventUseCase(events),
    update: new UpdateEventUseCase(events),
    setPublished: new SetEventPublishedUseCase(events),
    delete: new DeleteEventUseCase(events, storage),
    attachPhoto: new AttachEventPhotoUseCase(events, photos, new UploadImageUseCase(storage), storage),
    updatePhotoAlt: new UpdateEventPhotoAltUseCase(photos),
    reorderPhotos: new ReorderEventPhotosUseCase(photos),
    deactivatePhoto: new DeactivateEventPhotoUseCase(photos),
  };
}

let useCases: ReturnType<typeof createEventUseCases> | undefined;

/**
 * Built on first use, not at import time: the Cloudinary adapter reads its
 * credentials in the constructor, and a build that merely imports the actions
 * must not need them.
 */
export function getEventUseCases() {
  useCases ??= createEventUseCases();
  return useCases;
}
