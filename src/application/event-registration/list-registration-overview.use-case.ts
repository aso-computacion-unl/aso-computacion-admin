import { registrationState, type EventRegistrationMode, type RegistrationState } from "@/domain/event-registration";
import { todayInEcuador } from "@/domain/calendar-date";
import { eventLastDay } from "@/domain/event-registration-retention";
import { publicationState, type PublicationState } from "@/domain/publication-window";

import type { EventRegistrationRepository } from "../ports/event-registration-repository.port";
import type { EventRepository } from "../ports/event-repository.port";
import { soonestFirst } from "./soonest-first";

/** One event that takes registrations, as a row of the admin overview: counts only, no personal data. */
export interface RegistrationOverviewRow {
  /** Where the per-event registrants page lives. */
  id: string;
  slug: string;
  title: string;
  date: string | null;
  datePrecision: "day" | "month";
  mode: Exclude<EventRegistrationMode, "none">;
  /** `null` when the event has no limit. */
  capacity: number | null;
  registered: number;
  deadline: Date | null;
  state: RegistrationState;
  /** Whether the landing shows the event right now: a draft or scheduled event has registrants to see but no public ticket. */
  publication: PublicationState;
}

export interface RegistrationOverview {
  /** Today or later (a month-only event until its month is over; an undated one last): soonest first. */
  upcoming: RegistrationOverviewRow[];
  /** Already over: most recent first. */
  past: RegistrationOverviewRow[];
}

/**
 * Every event that takes registrations, at any date, for the admin page that gathers them (ADMIN and EDITOR read
 * the same counts as the per-event page). Unlike the public seats it also lists drafts and scheduled events.
 * The counts come from one aggregated query for all events.
 */
export class ListRegistrationOverviewUseCase {
  constructor(
    private readonly events: EventRepository,
    private readonly registrations: EventRegistrationRepository,
  ) {}

  async execute({ now = new Date() }: { now?: Date } = {}): Promise<RegistrationOverview> {
    const today = todayInEcuador(now);
    const taking = (await this.events.list()).map((event) => event.props).filter((event) => event.registrationMode !== "none");
    const counts = await this.registrations.countByEvents(taking.map((event) => event.id));
    // An event is over once its last possible day is behind us; without a date nothing says it happened.
    const isOver = (event: (typeof taking)[number]) => event.date !== null && eventLastDay(event.date, event.datePrecision) < today;
    const row = (event: (typeof taking)[number]): RegistrationOverviewRow => {
      const registered = counts.get(event.id) ?? 0;

      return {
        id: event.id,
        slug: event.slug,
        title: event.title,
        date: event.date,
        datePrecision: event.datePrecision,
        mode: event.registrationMode as RegistrationOverviewRow["mode"],
        capacity: event.registrationCapacity,
        registered,
        deadline: event.registrationDeadline,
        state: registrationState(event, registered, now),
        publication: publicationState(event, now),
      };
    };
    const mostRecentFirst = (a: RegistrationOverviewRow, b: RegistrationOverviewRow) => (b.date ?? "").localeCompare(a.date ?? "") || a.title.localeCompare(b.title);

    return {
      upcoming: taking.filter((event) => !isOver(event)).map(row).sort(soonestFirst),
      past: taking.filter(isOver).map(row).sort(mostRecentFirst),
    };
  }
}
