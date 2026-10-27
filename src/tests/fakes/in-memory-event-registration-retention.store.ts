import type { EventRegistrationRetentionStore, RetentionCandidate } from "@/application/ports/event-registration-retention.port";

import type { InMemoryEventRegistrationRepository } from "./in-memory-event-registration.repository";
import type { InMemoryEventRepository } from "./in-memory-event.repository";

/** In-memory `EventRegistrationRetentionStore` over the same fakes the registration use cases use. */
export class InMemoryEventRegistrationRetentionStore implements EventRegistrationRetentionStore {
  /** Every `deleteBatch` call, so a test can see the batches. */
  readonly batches: { eventIds: string[]; limit: number; deleted: number }[] = [];

  constructor(
    private readonly events: InMemoryEventRepository,
    private readonly registrations: InMemoryEventRegistrationRepository,
  ) {}

  async candidates(onOrBefore: string): Promise<RetentionCandidate[]> {
    const withRows = new Set(this.registrations.all().map((row) => row.eventId));
    const events = [...(await this.events.list()), ...(await this.events.listTrashed()).map((trashed) => trashed.entity)];

    return events
      .map((event) => event.props)
      .filter((props) => props.date !== null && props.date <= onOrBefore && withRows.has(props.id))
      .map((props) => ({ id: props.id, date: props.date, datePrecision: props.datePrecision }));
  }

  async deleteBatch(eventIds: string[], limit: number): Promise<number> {
    const doomed = this.registrations
      .all()
      .filter((row) => eventIds.includes(row.eventId))
      .slice(0, limit);

    for (const row of doomed) {
      await this.registrations.delete(row.eventId, row.id);
    }

    this.batches.push({ eventIds, limit, deleted: doomed.length });

    return doomed.length;
  }
}
