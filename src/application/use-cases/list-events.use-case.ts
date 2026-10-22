import type { EventListItemResult } from "../dto/event-result.dto";
import { toEventResult } from "../mappers/event-result.mapper";
import type { EventPhotoRepository } from "../ports/event-photo-repository.port";
import type { EventRepository } from "../ports/event-repository.port";

/** Admin listing: every event, drafts included, with how many active photos it has. */
export class ListEventsUseCase {
  constructor(
    private readonly events: EventRepository,
    private readonly photos: EventPhotoRepository,
  ) {}

  async execute(): Promise<EventListItemResult[]> {
    const events = await this.events.list();
    const counts = await this.photos.countActiveByEventIds(events.map((event) => event.props.id));

    return events.map((event) => ({ ...toEventResult(event), photoCount: counts.get(event.props.id) ?? 0 }));
  }
}
