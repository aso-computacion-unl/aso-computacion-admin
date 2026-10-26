import type { Actor } from "@/domain/user";
import { reportError } from "@/infrastructure/observability/report-error";

import { getAuthServices } from "../auth/auth-container";

const SUMMARY_MAX_LENGTH = 200;

/** Who an entry is attributed to: an actor from the guard, or the system (a failed login has no actor). */
export type AuditActor = Pick<Actor, "kind" | "userId"> | { kind: "system"; userId: null };

export const SYSTEM_ACTOR: AuditActor = { kind: "system", userId: null };

export interface AuditEvent {
  /** Dotted verb, e.g. `event.create`. */
  action: string;
  entityType: string;
  entityId?: string | null;
  /** Short and human readable. Names and ids only: never a content body, a secret or an email. */
  summary: string;
}

/**
 * Writes one audit entry after a mutation succeeded. A failure here must never fail the action the
 * user already completed, so it is reported (without the entry's contents) and swallowed.
 */
export async function recordAudit(actor: AuditActor, event: AuditEvent): Promise<void> {
  try {
    await getAuthServices().audit.record({
      actorUserId: actor.userId,
      actorKind: actor.kind,
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId ?? null,
      summary: event.summary.slice(0, SUMMARY_MAX_LENGTH),
    });
  } catch (error) {
    console.error(`Could not write the audit entry for ${event.action}.`);
    reportError(error, { action: "audit-log", audit: event.action });
  }
}
