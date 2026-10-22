import type { EventPhotoResult } from "../dto/event-result.dto";
import { toEventPhotoResult } from "../mappers/event-result.mapper";
import type { EventPhotoRepository } from "../ports/event-photo-repository.port";
import { findEventPhoto } from "./find-event-photo";

export interface UpdateEventPhotoAltCommand {
  eventId: string;
  photoId: string;
  alt: string;
}

export class UpdateEventPhotoAltUseCase {
  constructor(private readonly photos: EventPhotoRepository) {}

  async execute({ eventId, photoId, alt }: UpdateEventPhotoAltCommand): Promise<EventPhotoResult> {
    const photo = await findEventPhoto(this.photos, eventId, photoId);

    return toEventPhotoResult(await this.photos.update(photo.withAlt(alt)));
  }
}
