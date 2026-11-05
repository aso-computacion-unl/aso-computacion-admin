"use server";

import { revalidatePath } from "next/cache";

import { PartialSessionRevokeError, RevokeOtherSessionsUseCase } from "@/application/auth/session.use-cases";

import { recordAudit } from "../../audit/record-audit";
import { getAuthServices } from "../../auth/auth-container";
import { requireSession } from "../../auth/require-session";
import { mapActionError, type ActionResult } from "../action-result";

// Every action starts with the session guard, before it reads any input or touches a use case (a
// server action can be POSTed to any page). Anyone may revoke their own sessions; revoking someone
// else's takes the ADMIN role, which the use case checks against the actor the guard resolved.

const PAGE_PATH = "/admin/sesiones";

export async function revokeSession(sessionId: string): Promise<ActionResult> {
  try {
    const actor = await requireSession();

    await getAuthServices().revokeSession.execute({ actor, sessionId: String(sessionId) });
    await recordAudit(actor, { action: "session.revoke", entityType: "session", entityId: String(sessionId), summary: "Sesión cerrada" });
    revalidatePath(PAGE_PATH);
    return { success: true };
  } catch (error) {
    return mapActionError(error);
  }
}

/** "Cerrar las demás": the person's other sessions, never the caller's current one. Same permission as `revokeSession`, decided by the use case. */
export async function revokeOtherSessions(userId: string): Promise<ActionResult> {
  try {
    const actor = await requireSession();
    const { listSessions, revokeSession } = getAuthServices();
    const target = String(userId);

    const auditClosed = (closed: number) =>
      closed > 0 ? recordAudit(actor, { action: "session.revoke_others", entityType: "session", entityId: target, summary: `Sesiones cerradas: ${closed}` }) : undefined;

    let closed: number;

    try {
      closed = await new RevokeOtherSessionsUseCase(listSessions, revokeSession).execute({ actor, userId: target });
    } catch (error) {
      if (!(error instanceof PartialSessionRevokeError)) throw error;

      // What was closed before the failure still happened: record it and refresh the list, then report the failure.
      await auditClosed(error.closed);
      revalidatePath(PAGE_PATH);
      return mapActionError(error.cause);
    }

    await auditClosed(closed);
    revalidatePath(PAGE_PATH);
    return { success: true };
  } catch (error) {
    return mapActionError(error);
  }
}
