import { registrationRefusal } from "@/domain/event-registration";

import { soonestFirst } from "./soonest-first";
import type { EventResult } from "../dto/event-result.dto";
import type { EventRegistrationRepository } from "../ports/event-registration-repository.port";
import type { EventRepository } from "../ports/event-repository.port";

/** What a link to a registration page needs: no personal data, only a count. */
export interface OpenUnlEvent extends Pick<EventResult, "slug" | "title" | "date" | "datePrecision" | "description"> {
  capacity: number | null;
  /** `null` when the event has no limit. */
  seatsLeft: number | null;
}

/** Every public event that takes a UNL-account registration right now: the forum's "Inscripciones" page and its rail count. */
export class ListOpenUnlEventsUseCase {
  constructor(
    private readonly events: EventRepository,
    private readonly registrations: EventRegistrationRepository,
  ) {}

  async execute({ now = new Date() }: { now?: Date } = {}): Promise<OpenUnlEvent[]> {
    const published = await this.events.list({ status: "published" });
    // The same rule the registration itself applies, minus the seat count: that needs one query per event.
    const candidates = published
      .map((event) => event.props)
      .filter((event) => event.registrationMode === "unl" && registrationRefusal({ event, mode: "unl", registered: 0, alreadyRegistered: false, now }) === null)
      .sort(soonestFirst);
    const open: OpenUnlEvent[] = [];

    for (const event of candidates) {
      const capacity = event.registrationCapacity;
      const seatsLeft = capacity === null ? null : capacity - (await this.registrations.count(event.id));

      if (seatsLeft !== null && seatsLeft <= 0) continue;

      open.push({ slug: event.slug, title: event.title, date: event.date, datePrecision: event.datePrecision, description: event.description, capacity, seatsLeft });
    }

    return open;
  }
}
