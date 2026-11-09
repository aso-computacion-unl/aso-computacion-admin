import type { CancellationRefusal, RegistrationMode, RegistrationRefusal } from "@/domain/event-registration";

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

export type NewEventRegistration = Omit<EventRegistrationRecord, "createdAt" | "reminderSentAt"> & {
  /**
   * The attempt the confirmation link of a pending row is issued for (D9). Stored beside the row, never part of the
   * record: it is a credential, not data about the person. Absent or `null` for a row that is never confirmed by a link.
   */
  confirmNonce?: string | null;
};

export type RegisterOutcome = { status: "registered"; registration: EventRegistrationRecord } | { status: RegistrationRefusal };

/**
 * Confirming the email of a pending registration. `invalid`: no such registration in that event, or the link is not
 * the one of its latest attempt. `expired`: the confirmation window ran out. A refusal (`full`, `closed`, ...) leaves the row pending, as it was.
 */
export type ConfirmOutcome =
  | { status: "confirmed" | "already_confirmed"; registration: EventRegistrationRecord }
  | { status: "invalid" | "expired" }
  | { status: Exclude<RegistrationRefusal, "duplicate"> };

/**
 * Cancelling a registration (D7). `cancelled`: the row is gone and its seat is free. `not_registered`: there was none (it was
 * already cancelled, deleted by staff or purged). A refusal (`not_found`: the event is not public or is in the trash;
 * `closed`) changes nothing.
 */
export type CancelOutcome = { status: "cancelled" | "not_registered" } | { status: CancellationRefusal };

/** Whose registration to cancel: the one a signed link names, or the one of a verified email (a signed-in UNL member). */
export type CancelTarget = { id: string } | { email: string };

/** Persistence port for event registrations. Implemented by the Prisma adapter and by an in-memory fake. */
export interface EventRegistrationRepository {
  /**
   * Stores the registration unless `registrationRefusal` says no. The check and the insert are one atomic
   * step, serialized per event: two people racing for the last seat cannot both get it, and the same
   * email cannot be stored twice. A refusal changes nothing. Only confirmed rows count: the same email still
   * pending is not a duplicate, its row is refreshed (same id, new data, `createdAt` = now, new `confirmNonce`, which
   * retires the link of the previous attempt) and returned.
   */
  register(input: NewEventRegistration, now: Date): Promise<RegisterOutcome>;
  /**
   * Confirms a pending row with the same atomic check as `register`: the seat is taken now, or refused. `nonce` is the
   * attempt the link names (`null`: a link that names none): a row only answers to the nonce it holds now, so the link of
   * an earlier attempt is `invalid` and changes nothing.
   */
  confirm(eventId: string, id: string, now: Date, nonce?: string | null): Promise<ConfirmOutcome>;
  /**
   * Deletes the registration `who` names, if `cancellationRefusal` allows it, under the same per-event lock as `register`
   * and `confirm`: the freed seat is seen by whoever registers next, never half-freed. Pending rows go too (they hold no
   * seat, only personal data). A refusal or a missing row changes nothing.
   */
  cancel(eventId: string, who: CancelTarget, now: Date): Promise<CancelOutcome>;
  /** Confirmed registrations only, oldest first. */
  list(eventId: string): Promise<EventRegistrationRecord[]>;
  /** Confirmed registrations only. */
  count(eventId: string): Promise<number>;
  /** Confirmed registrations per event in ONE query; an event with none is absent from the map. For lists, where `count` per event would be N+1. */
  countByEvents(eventIds: readonly string[]): Promise<ReadonlyMap<string, number>>;
  /** A confirmed registration with that email. */
  exists(eventId: string, email: string): Promise<boolean>;
  /** Confirmed registrations of the event whose reminder has not gone out yet, oldest first, at most `limit`. */
  listDueForReminder(eventId: string, limit: number): Promise<EventRegistrationRecord[]>;
  /** Records when a reminder went out, once: true for the call that recorded it, false when it was already recorded or the row is not a confirmed registration of that event. */
  markReminderSent(eventId: string, id: string, at: Date): Promise<boolean>;
  /** True when a registration of that event was removed; false when there was none. */
  delete(eventId: string, id: string): Promise<boolean>;
}
