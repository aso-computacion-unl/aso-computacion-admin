import { isPubliclyVisible } from "@/domain/publication-window";
import { registrationState, type RegistrationState } from "@/domain/event-registration";

import type { EventRegistrationRepository } from "../ports/event-registration-repository.port";
import type { EventRepository } from "../ports/event-repository.port";
import { soonestFirst } from "./soonest-first";

/** The seats of one event that takes registrations: public, so nothing but counts and the slug the landing already knows. */
export interface EventSeats {
  slug: string;
  /** `null` when the event has no limit. */
  capacity: number | null;
  registered: number;
  /** `null` when the event has no limit; never below zero. */
  seatsLeft: number | null;
  status: RegistrationState;
}

/**
 * The seats of every publicly visible event that takes registrations, whichever mode and whenever it happens:
 * the landing's tickets read them. Visibility and the closing rules are the registration's own
 * (`isPubliclyVisible`, `registrationState`); the counts come from one aggregated query for all events.
 */
export class ListEventSeatsUseCase {
  constructor(
    private readonly events: EventRepository,
    private readonly registrations: EventRegistrationRepository,
  ) {}

  async execute({ now = new Date() }: { now?: Date } = {}): Promise<EventSeats[]> {
    const published = await this.events.list({ status: "published" });
    const takingRegistrations = published
      .map((event) => event.props)
      .filter((event) => event.registrationMode !== "none" && isPubliclyVisible(event, now))
      .sort(soonestFirst);
    const counts = await this.registrations.countByEvents(takingRegistrations.map((event) => event.id));

    return takingRegistrations.map((event) => {
      const registered = counts.get(event.id) ?? 0;
      const capacity = event.registrationCapacity;

      return {
        slug: event.slug,
        capacity,
        registered,
        seatsLeft: capacity === null ? null : Math.max(0, capacity - registered),
        status: registrationState(event, registered, now),
      };
    });
  }
}
