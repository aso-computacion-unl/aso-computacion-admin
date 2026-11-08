import type { RegistrationMode, RegistrationRefusal } from "@/domain/event-registration";

/** One stored registration: personal data, so only what the way of registering needs. */
export interface EventRegistrationRecord {
  id: string;
  eventId: string;
  mode: RegistrationMode;
  name: string;
  /** Lower-cased. Verified by Google in `unl` mode, as typed in `open` mode. */
  email: string;
  /** Only the open form collects these three; career and semester are optional there. */
  institution: string | null;
  career: string | null;
  semester: number | null;
  /** When it was stored, or last re-sent while pending: the confirmation window counts from here. */
  createdAt: Date;
  /** `null` while an open-form email is unconfirmed: such a row takes no seat and nobody lists or counts it. UNL rows are born confirmed. */
  confirmedAt: Date | null;
  /** When the reminder before the event went out; `null` until then. */
  reminderSentAt: Date | null;
}

export type NewEventRegistration = Omit<EventRegistrationRecord, "createdAt" | "reminderSentAt">;

export type RegisterOutcome = { status: "registered"; registration: EventRegistrationRecord } | { status: RegistrationRefusal };

/**
 * Confirming the email of a pending registration. `invalid`: no such registration in that event. `expired`: the
 * confirmation window ran out. A refusal (`full`, `closed`, ...) leaves the row pending, as it was.
 */
export type ConfirmOutcome =
  | { status: "confirmed" | "already_confirmed"; registration: EventRegistrationRecord }
  | { status: "invalid" | "expired" }
  | { status: Exclude<RegistrationRefusal, "duplicate"> };

/** Persistence port for event registrations. Implemented by the Prisma adapter and by an in-memory fake. */
export interface EventRegistrationRepository {
  /**
   * Stores the registration unless `registrationRefusal` says no. The check and the insert are one atomic
   * step, serialized per event: two people racing for the last seat cannot both get it, and the same
   * email cannot be stored twice. A refusal changes nothing. Only confirmed rows count: the same email still
   * pending is not a duplicate, its row is refreshed (same id, new data, `createdAt` = now) and returned.
   */
  register(input: NewEventRegistration, now: Date): Promise<RegisterOutcome>;
  /** Confirms a pending row with the same atomic check as `register`: the seat is taken now, or refused. */
  confirm(eventId: string, id: string, now: Date): Promise<ConfirmOutcome>;
  /** Confirmed registrations only, oldest first. */
  list(eventId: string): Promise<EventRegistrationRecord[]>;
  /** Confirmed registrations only. */
  count(eventId: string): Promise<number>;
  /** Confirmed registrations per event in ONE query; an event with none is absent from the map. For lists, where `count` per event would be N+1. */
  countByEvents(eventIds: readonly string[]): Promise<ReadonlyMap<string, number>>;
  /** A confirmed registration with that email. */
  exists(eventId: string, email: string): Promise<boolean>;
  /** True when a registration of that event was removed; false when there was none. */
  delete(eventId: string, id: string): Promise<boolean>;
}
