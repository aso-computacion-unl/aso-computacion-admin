import type { RetainedEvent } from "@/domain/event-registration-retention";

export interface RetentionCandidate extends RetainedEvent {
  id: string;
}

/** Persistence port for the retention purge of event registrations. Implemented by the Prisma adapter and an in-memory fake. */
export interface EventRegistrationRetentionStore {
  /**
   * Events that have at least one registration and a date on or before `onOrBefore` (YYYY-MM-DD), trashed
   * ones included: a trashed event still holds its people's data.
   */
  candidates(onOrBefore: string): Promise<RetentionCandidate[]>;
  /** Deletes at most `limit` registrations of the given events and resolves with how many it deleted. Registrations only. */
  deleteBatch(eventIds: string[], limit: number): Promise<number>;
}
