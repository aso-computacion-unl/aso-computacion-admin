import { isPubliclyVisible } from "@/domain/publication-window";

import type { EventResult } from "../dto/event-result.dto";
import { toEventResult } from "../mappers/event-result.mapper";
import type { EventRepository } from "../ports/event-repository.port";

/** One event as the public sees it: null unless it is published and inside its window at `now`. */
export class GetPublicEventUseCase {
  constructor(private readonly events: EventRepository) {}

  async execute({ slug, now = new Date() }: { slug: string; now?: Date }): Promise<EventResult | null> {
    const event = await this.events.findLiveBySlug(slug);

    return event && isPubliclyVisible(event.props, now) ? toEventResult(event) : null;
  }
}
