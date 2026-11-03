import type { RegistrationMode, RegistrationRefusal } from "@/domain/event-registration";

/** One stored registration: personal data, so only what the way of registering needs. */
export interface EventRegistrationRecord {
  id: string;
  eventId: string;
  mode: RegistrationMode;
  name: string;
  /** Lower-cased. Verified by Google in `unl` mode, as typed in `open` mode. */
  email: string;
  /** Only the open form collects these two. */
  career: string | null;
  semester: number | null;
  createdAt: Date;
}

export type NewEventRegistration = Omit<EventRegistrationRecord, "createdAt">;

export type RegisterOutcome = { status: "registered"; registration: EventRegistrationRecord } | { status: RegistrationRefusal };

/** Persistence port for event registrations. Implemented by the Prisma adapter and by an in-memory fake. */
export interface EventRegistrationRepository {
  /**
   * Stores the registration unless `registrationRefusal` says no. The check and the insert are one atomic
   * step, serialized per event: two people racing for the last seat cannot both get it, and the same
   * email cannot be stored twice. A refusal changes nothing.
   */
  register(input: NewEventRegistration, now: Date): Promise<RegisterOutcome>;
  /** Oldest first. */
  list(eventId: string): Promise<EventRegistrationRecord[]>;
  count(eventId: string): Promise<number>;
  /** Registrations per event in ONE query; an event with none is absent from the map. For lists, where `count` per event would be N+1. */
  countByEvents(eventIds: readonly string[]): Promise<ReadonlyMap<string, number>>;
  exists(eventId: string, email: string): Promise<boolean>;
  /** True when a registration of that event was removed; false when there was none. */
  delete(eventId: string, id: string): Promise<boolean>;
}
