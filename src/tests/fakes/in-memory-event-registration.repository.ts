import type {
  CancelOutcome,
  CancelTarget,
  ConfirmOutcome,
  EventRegistrationRecord,
  EventRegistrationRepository,
  NewEventRegistration,
  RegisterOutcome,
} from "@/application/ports/event-registration-repository.port";
import { cancellationRefusal, isConfirmationExpired, registrationRefusal } from "@/domain/event-registration";

import type { InMemoryEventRepository } from "./in-memory-event.repository";

/** Deterministic in-memory `EventRegistrationRepository` that applies the same decision as the Prisma adapter. */
export class InMemoryEventRegistrationRepository implements EventRegistrationRepository {
  private readonly rows: EventRegistrationRecord[] = [];
  /** The attempt of each row's confirmation link, by registration id: kept apart from the record like the Prisma column. */
  private readonly nonces = new Map<string, string>();

  constructor(private readonly events: InMemoryEventRepository) {}

  clear(): void {
    this.rows.length = 0;
    this.nonces.clear();
  }

  all(): EventRegistrationRecord[] {
    return [...this.rows];
  }

  /**
   * Stores a row as is, bypassing the registration rules: for tests that need people registered for past events.
   * Unless told otherwise the row is a confirmed seat (confirmed when created), outside the UNL-free fields.
   */
  seed(row: Omit<EventRegistrationRecord, "institution" | "confirmedAt" | "reminderSentAt"> & Partial<EventRegistrationRecord>): void {
    this.rows.push({ institution: null, confirmedAt: row.createdAt, reminderSentAt: null, ...row });
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

    const { confirmNonce, ...data } = input;
    const pending = this.rows.findIndex((row) => row.eventId === input.eventId && row.email === input.email);
    const registration: EventRegistrationRecord = { ...data, createdAt: now, reminderSentAt: null };

    if (pending === -1) {
      this.rows.push(registration);
      this.remember(registration.id, confirmNonce);

      return { status: "registered", registration };
    }

    const refreshed = { ...registration, id: this.rows[pending]!.id };

    this.rows[pending] = refreshed;
    this.remember(refreshed.id, confirmNonce);

    return { status: "registered", registration: refreshed };
  }

  /** The attempt the registration's confirmation link was issued for, or `null` when it has none (a seeded row, a UNL row). */
  confirmNonceOf(id: string): string | null {
    return this.nonces.get(id) ?? null;
  }

  private remember(id: string, nonce: string | null | undefined): void {
    if (nonce) {
      this.nonces.set(id, nonce);
    } else {
      this.nonces.delete(id);
    }
  }

  async confirm(eventId: string, id: string, now: Date, nonce: string | null = null): Promise<ConfirmOutcome> {
    const event = await this.events.getById(eventId);
    const index = this.rows.findIndex((row) => row.eventId === eventId && row.id === id);
    const row = this.rows[index];

    if (!event || !row || (this.nonces.get(row.id) ?? null) !== nonce) {
      return { status: "invalid" };
    }

    if (row.confirmedAt) {
      return { status: "already_confirmed", registration: row };
    }

    if (isConfirmationExpired(row.createdAt, now)) {
      return { status: "expired" };
    }

    const refusal = registrationRefusal({ event: event.props, mode: row.mode, registered: await this.count(eventId), alreadyRegistered: false, now });

    if (refusal) {
      return { status: refusal as Exclude<typeof refusal, "duplicate"> };
    }

    const registration = { ...row, confirmedAt: now };

    this.rows[index] = registration;

    return { status: "confirmed", registration };
  }

  async cancel(eventId: string, who: CancelTarget, now: Date): Promise<CancelOutcome> {
    const event = await this.events.getById(eventId);

    if (!event) {
      return { status: "not_found" };
    }

    const refusal = cancellationRefusal({ event: event.props, now });

    if (refusal) {
      return { status: refusal };
    }

    const index = this.rows.findIndex((row) => row.eventId === eventId && ("id" in who ? row.id === who.id : row.email === who.email));

    if (index === -1) {
      return { status: "not_registered" };
    }

    const [removed] = this.rows.splice(index, 1);

    this.nonces.delete(removed!.id);

    return { status: "cancelled" };
  }

  private confirmed(): EventRegistrationRecord[] {
    return this.rows.filter((row) => row.confirmedAt !== null);
  }

  async list(eventId: string): Promise<EventRegistrationRecord[]> {
    return this.confirmed()
      .filter((row) => row.eventId === eventId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async count(eventId: string): Promise<number> {
    return this.confirmed().filter((row) => row.eventId === eventId).length;
  }

  async countByEvents(eventIds: readonly string[]): Promise<ReadonlyMap<string, number>> {
    const counts = new Map<string, number>();

    for (const row of this.confirmed()) {
      if (eventIds.includes(row.eventId)) counts.set(row.eventId, (counts.get(row.eventId) ?? 0) + 1);
    }

    return counts;
  }

  async exists(eventId: string, email: string): Promise<boolean> {
    return this.confirmed().some((row) => row.eventId === eventId && row.email === email);
  }

  async listDueForReminder(eventId: string, limit: number): Promise<EventRegistrationRecord[]> {
    return (await this.list(eventId)).filter((row) => row.reminderSentAt === null).slice(0, Math.max(0, limit));
  }

  async markReminderSent(eventId: string, id: string, at: Date): Promise<boolean> {
    const index = this.rows.findIndex((row) => row.eventId === eventId && row.id === id && row.confirmedAt !== null && row.reminderSentAt === null);

    if (index === -1) {
      return false;
    }

    this.rows[index] = { ...this.rows[index]!, reminderSentAt: at };

    return true;
  }

  async delete(eventId: string, id: string): Promise<boolean> {
    const index = this.rows.findIndex((row) => row.eventId === eventId && row.id === id);

    if (index === -1) {
      return false;
    }

    this.rows.splice(index, 1);
    this.nonces.delete(id);

    return true;
  }
}
