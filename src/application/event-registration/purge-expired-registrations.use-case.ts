import { registrationsExpired, retentionCandidateCutoff } from "@/domain/event-registration-retention";

import type { EventRegistrationRetentionStore } from "../ports/event-registration-retention.port";

/** Rows deleted per statement, so one run never holds a long lock or builds a huge statement. */
export const PURGE_BATCH_SIZE = 500;
/** Statements per run: 10 000 rows. A bigger backlog is finished by the next daily run. */
export const PURGE_MAX_BATCHES = 20;

export interface PurgeResult {
  deleted: number;
}

/** A batch failed after earlier ones had deleted rows: carries that count so it can still be audited. */
export class PurgeInterruptedError extends Error {
  constructor(
    readonly deleted: number,
    cause: unknown,
  ) {
    super("The registration purge was interrupted", { cause });
    this.name = "PurgeInterruptedError";
  }
}

/**
 * Retention: deletes the registrations of every event that ended more than 90 days ago (see
 * `registrationsExpired`). It deletes registrations only, never the event, and it is idempotent: running it
 * again deletes what became due since, and nothing else. Run from the daily cron.
 */
export class PurgeExpiredRegistrationsUseCase {
  constructor(private readonly store: EventRegistrationRetentionStore) {}

  async execute(now: Date): Promise<PurgeResult> {
    const candidates = await this.store.candidates(retentionCandidateCutoff(now));
    const expiredEventIds = candidates.filter((event) => registrationsExpired(event, now)).map((event) => event.id);
    let deleted = 0;

    if (expiredEventIds.length === 0) {
      return { deleted };
    }

    for (let batch = 0; batch < PURGE_MAX_BATCHES; batch += 1) {
      let count: number;

      try {
        count = await this.store.deleteBatch(expiredEventIds, PURGE_BATCH_SIZE);
      } catch (error) {
        throw deleted > 0 ? new PurgeInterruptedError(deleted, error) : error;
      }

      deleted += count;

      if (count < PURGE_BATCH_SIZE) {
        break;
      }
    }

    return { deleted };
  }
}
