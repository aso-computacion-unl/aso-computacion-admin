import type { Event } from "@/domain/event";

import type { EventListItemResult } from "../dto/event-result.dto";
import { toEventResult } from "../mappers/event-result.mapper";
import type { ListCriteria, Page, PageRequest } from "../ports/list-criteria";
import type { EventPhotoRepository } from "../ports/event-photo-repository.port";
import type { EventRepository } from "../ports/event-repository.port";

/** Admin listing: every event, drafts included unless the criteria narrows it, with how many active photos it has. */
export class ListEventsUseCase {
  constructor(
    private readonly events: EventRepository,
    private readonly photos: EventPhotoRepository,
  ) {}

  async execute(criteria: ListCriteria = {}): Promise<EventListItemResult[]> {
    return this.withPhotoCounts(await this.events.list(criteria));
  }

  /** One page of the same listing; the photo counts are read for the events on the page only. */
  async executePage(criteria: ListCriteria, request: PageRequest): Promise<Page<EventListItemResult>> {
    const page = await this.events.listPage(criteria, request);

    return { ...page, items: await this.withPhotoCounts(page.items) };
  }

  private async withPhotoCounts(events: Event[]): Promise<EventListItemResult[]> {
    const counts = await this.photos.countActiveByEventIds(events.map((event) => event.props.id));

    return events.map((event) => ({ ...toEventResult(event), photoCount: counts.get(event.props.id) ?? 0 }));
  }
}
