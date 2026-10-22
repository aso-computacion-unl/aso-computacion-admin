import type { EventPhotoRepository } from "../ports/event-photo-repository.port";
import { NotFoundError } from "./use-case-error";

export interface ReorderEventPhotosCommand {
  eventId: string;
  photoId: string;
  direction: "up" | "down";
}

/** Moves one active photo a single step and renumbers the gallery 0..n-1. */
export class ReorderEventPhotosUseCase {
  constructor(private readonly photos: EventPhotoRepository) {}

  async execute({ eventId, photoId, direction }: ReorderEventPhotosCommand): Promise<void> {
    const ids = (await this.photos.listActiveByEventId(eventId)).map((photo) => photo.props.id);
    const index = ids.indexOf(photoId);

    if (index === -1) {
      throw new NotFoundError("Event photo not found");
    }

    const target = direction === "up" ? index - 1 : index + 1;
    const neighbour = ids[target];

    if (neighbour !== undefined) {
      ids[target] = photoId;
      ids[index] = neighbour;
    }

    await this.photos.saveOrder(eventId, ids);
  }
}
