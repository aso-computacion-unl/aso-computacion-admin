import type { EventDetailResult } from "../dto/event-result.dto";
import { toEventPhotoResult, toEventResult } from "../mappers/event-result.mapper";
import type { EventPhotoRepository } from "../ports/event-photo-repository.port";
import type { EventRepository } from "../ports/event-repository.port";
import { NotFoundError } from "./use-case-error";

export class GetEventUseCase {
  constructor(
    private readonly events: EventRepository,
    private readonly photos: EventPhotoRepository,
  ) {}

  async execute({ id }: { id: string }): Promise<EventDetailResult> {
    const event = await this.events.getById(id);

    if (!event) {
      throw new NotFoundError("Event not found");
    }

    const photos = await this.photos.listActiveByEventId(id);

    return { ...toEventResult(event), photos: photos.map(toEventPhotoResult) };
  }
}
