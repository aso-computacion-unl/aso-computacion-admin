import type { EventPhoto } from "@/domain/event-photo";

import type { EventPhotoRepository } from "../ports/event-photo-repository.port";
import { NotFoundError } from "./use-case-error";

/** A photo addressed through its event: the pair must match, otherwise it does not exist for the caller. */
export async function findEventPhoto(
  photos: EventPhotoRepository,
  eventId: string,
  photoId: string,
): Promise<EventPhoto> {
  const photo = await photos.getById(photoId);

  if (!photo || photo.props.eventId !== eventId || !photo.props.isActive) {
    throw new NotFoundError("Event photo not found");
  }

  return photo;
}
