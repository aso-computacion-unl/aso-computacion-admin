import type { EventPhotoRepository } from "../ports/event-photo-repository.port";
import type { EventRepository } from "../ports/event-repository.port";
import { findEventPhoto } from "./find-event-photo";

export interface DeactivateEventPhotoCommand {
  eventId: string;
  photoId: string;
}

/** Soft retention: the row is hidden and the stored asset is kept. */
export class DeactivateEventPhotoUseCase {
  constructor(
    private readonly events: EventRepository,
    private readonly photos: EventPhotoRepository,
  ) {}

  async execute({ eventId, photoId }: DeactivateEventPhotoCommand): Promise<void> {
    const photo = await findEventPhoto(this.events, this.photos, eventId, photoId);

    await this.photos.update(photo.deactivate());
  }
}
