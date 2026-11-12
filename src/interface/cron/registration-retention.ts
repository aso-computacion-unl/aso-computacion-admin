import { PurgeInterruptedError, type PurgeResult } from "@/application";

import { SYSTEM_ACTOR, recordAudit } from "../audit/record-audit";
import { getPurgeExpiredRegistrations } from "./registration-retention-container";

const ACTION = "event.registration_purge";

/**
 * Deletes the registrations whose retention period is over and audits the run: one entry by the system, with
 * the count only (a registration is a person, so no name, email or event title ever reaches the log). A run
 * that deleted nothing writes nothing; a run that failed after deleting some still audits those, then fails.
 */
export async function runRegistrationRetention(now: Date): Promise<PurgeResult> {
  try {
    const result = await getPurgeExpiredRegistrations().execute(now);

    if (result.deleted > 0) {
      await recordAudit(SYSTEM_ACTOR, {
        action: ACTION,
        entityType: "event",
        summary: `Depuración de inscripciones: ${result.deleted} eliminadas (90 días después de cada evento o correo sin confirmar en 48 h)`,
      });
    }

    return result;
  } catch (error) {
    if (error instanceof PurgeInterruptedError) {
      await recordAudit(SYSTEM_ACTOR, {
        action: ACTION,
        entityType: "event",
        summary: `Depuración de inscripciones interrumpida: ${error.deleted} eliminadas antes del fallo`,
      });

      throw error.cause;
    }

    throw error;
  }
}
