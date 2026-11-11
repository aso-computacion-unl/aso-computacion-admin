import { registrationState, type RegistrationMode } from "@/domain/event-registration";
import { isPubliclyVisible } from "@/domain/publication-window";

import { soonestFirst } from "./soonest-first";
import type { EventResult } from "../dto/event-result.dto";
import type { EventRegistrationRepository } from "../ports/event-registration-repository.port";
import type { EventRepository } from "../ports/event-repository.port";

/** What a card of the public registrations list needs: no personal data, only a count. */
export interface OpenRegistrationEvent extends Pick<EventResult, "slug" | "title" | "date" | "datePrecision" | "description" | "hora" | "lugar"> {
  /** How the event takes registrations: a UNL account or the open form. */
  mode: RegistrationMode;
  capacity: number | null;
  /** `null` when the event has no limit. */
  seatsLeft: number | null;
}

/**
 * Every public event that takes a registration right now, whichever way it takes them (a UNL account or the open
 * form): the `/inscripciones` list. A closed or full event is left out, by the registration's own rule
 * (`registrationState`); the seats come from one aggregated query for all events.
 */
export class ListOpenRegistrationEventsUseCase {
  constructor(
    private readonly events: EventRepository,
    private readonly registrations: EventRegistrationRepository,
  ) {}

  async execute({ now = new Date() }: { now?: Date } = {}): Promise<OpenRegistrationEvent[]> {
    const published = await this.events.list({ status: "published" });
    const taking = published
      .map((event) => event.props)
      .filter((event) => event.registrationMode !== "none" && isPubliclyVisible(event, now))
      .sort(soonestFirst);
    const counts = await this.registrations.countByEvents(taking.map((event) => event.id));
    const open: OpenRegistrationEvent[] = [];

    for (const event of taking) {
      const registered = counts.get(event.id) ?? 0;

      if (event.registrationMode === "none" || registrationState(event, registered, now) !== "open") continue;

      const capacity = event.registrationCapacity;

      open.push({
        slug: event.slug,
        title: event.title,
        date: event.date,
        datePrecision: event.datePrecision,
        description: event.description,
        hora: event.hora,
        lugar: event.lugar,
        mode: event.registrationMode,
        capacity,
        seatsLeft: capacity === null ? null : capacity - registered,
      });
    }

    return open;
  }
}
