import type {
  EventRegistrationRecord,
  EventRegistrationRepository,
  NewEventRegistration,
  RegisterOutcome,
} from "@/application/ports/event-registration-repository.port";
import { registrationRefusal } from "@/domain/event-registration";

import type { InMemoryEventRepository } from "./in-memory-event.repository";

/** Deterministic in-memory `EventRegistrationRepository` that applies the same decision as the Prisma adapter. */
export class InMemoryEventRegistrationRepository implements EventRegistrationRepository {
  private readonly rows: EventRegistrationRecord[] = [];

  constructor(private readonly events: InMemoryEventRepository) {}

  clear(): void {
    this.rows.length = 0;
  }

  all(): EventRegistrationRecord[] {
    return [...this.rows];
  }

  /** Stores a row as is, bypassing the registration rules: for tests that need people registered for past events. */
  seed(row: EventRegistrationRecord): void {
    this.rows.push(row);
  }

  async register(input: NewEventRegistration, now: Date): Promise<RegisterOutcome> {
    const event = await this.events.getById(input.eventId);

    if (!event) {
      return { status: "not_found" };
    }

    const refusal = registrationRefusal({
      event: event.props,
      mode: input.mode,
      registered: await this.count(input.eventId),
      alreadyRegistered: await this.exists(input.eventId, input.email),
      now,
    });

    if (refusal) {
      return { status: refusal };
    }

    const registration = { ...input, createdAt: now };

    this.rows.push(registration);

    return { status: "registered", registration };
  }

  async list(eventId: string): Promise<EventRegistrationRecord[]> {
    return this.rows.filter((row) => row.eventId === eventId).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async count(eventId: string): Promise<number> {
    return this.rows.filter((row) => row.eventId === eventId).length;
  }

  async exists(eventId: string, email: string): Promise<boolean> {
    return this.rows.some((row) => row.eventId === eventId && row.email === email);
  }

  async delete(eventId: string, id: string): Promise<boolean> {
    const index = this.rows.findIndex((row) => row.eventId === eventId && row.id === id);

    if (index === -1) {
      return false;
    }

    this.rows.splice(index, 1);

    return true;
  }
}
