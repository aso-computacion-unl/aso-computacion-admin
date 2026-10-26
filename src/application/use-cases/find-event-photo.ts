import type { EventPhoto } from "@/domain/event-photo";

import type { EventPhotoRepository } from "../ports/event-photo-repository.port";
import type { EventRepository } from "../ports/event-repository.port";
import { NotFoundError } from "./use-case-error";

/**
 * A photo addressed through its event: the pair must match, otherwise it does not exist for the caller.
 * A photo of a trashed event does not exist for the caller either, until the event is restored.
 */
export async function findEventPhoto(
  events: EventRepository,
  photos: EventPhotoRepository,
  eventId: string,
  photoId: string,
): Promise<EventPhoto> {
  if (!(await events.getById(eventId))) {
    throw new NotFoundError("Event photo not found");
  }

  const photo = await photos.getById(photoId);

  if (!photo || photo.props.eventId !== eventId || !photo.props.isActive) {
    throw new NotFoundError("Event photo not found");
  }

  return photo;
}
