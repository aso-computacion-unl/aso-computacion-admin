import { EventPhoto, MAX_ACTIVE_EVENT_PHOTOS, assertEventPhotoAlt } from "@/domain/event-photo";
import { ValidationError } from "@/domain/domain-error";

import type { EventPhotoResult } from "../dto/event-result.dto";
import { toEventPhotoResult } from "../mappers/event-result.mapper";
import type { EventPhotoRepository } from "../ports/event-photo-repository.port";
import type { EventRepository } from "../ports/event-repository.port";
import type { ImageUploadFile, MediaStoragePort } from "../ports/media-storage.port";
import { NotFoundError } from "./use-case-error";
import type { UploadImageUseCase } from "./upload-image.use-case";

export const EVENT_PHOTO_FOLDER = "events";
export const EVENT_PHOTO_MIN_WIDTH = 1200;

export interface AttachEventPhotoCommand {
  eventId: string;
  file: ImageUploadFile;
  alt: string;
}

/**
 * Uploads a photo and appends it to the event's gallery.
 *
 * Everything that can be checked without storage (event exists, alt text,
 * room left in the gallery) is checked BEFORE the upload so a doomed request
 * never costs a transfer. The upload comes next and the DB write last, so a
 * write failure leaves an asset nobody references: it is destroyed here
 * (best effort, logged when that fails too) and the original error is the one
 * the caller sees.
 */
export class AttachEventPhotoUseCase {
  constructor(
    private readonly events: EventRepository,
    private readonly photos: EventPhotoRepository,
    private readonly uploadImage: UploadImageUseCase,
    private readonly storage: MediaStoragePort,
  ) {}

  async execute({ eventId, file, alt }: AttachEventPhotoCommand): Promise<EventPhotoResult> {
    const validAlt = assertEventPhotoAlt(alt);

    if (!(await this.events.getById(eventId))) {
      throw new NotFoundError("Event not found");
    }

    const active = await this.photos.listActiveByEventId(eventId);

    if (active.length >= MAX_ACTIVE_EVENT_PHOTOS) {
      throw new ValidationError("photos", `An event can have at most ${MAX_ACTIVE_EVENT_PHOTOS} active photos`);
    }

    const asset = await this.uploadImage.execute({
      file,
      folder: EVENT_PHOTO_FOLDER,
      minWidth: EVENT_PHOTO_MIN_WIDTH,
    });

    try {
      const sortOrder = active.reduce((next, photo) => Math.max(next, photo.props.sortOrder + 1), 0);
      const photo = EventPhoto.create({ eventId, ...asset, alt: validAlt, sortOrder });

      return toEventPhotoResult(await this.photos.add(photo, MAX_ACTIVE_EVENT_PHOTOS));
    } catch (error) {
      await this.destroyOrphan(asset.publicId);
      throw error;
    }
  }

  private async destroyOrphan(publicId: string): Promise<void> {
    try {
      await this.storage.destroy(publicId);
    } catch (cleanupError) {
      console.error(`Could not destroy orphaned event photo asset "${publicId}":`, cleanupError);
    }
  }
}
