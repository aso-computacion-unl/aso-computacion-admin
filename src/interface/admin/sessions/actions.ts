"use server";

import { revalidatePath } from "next/cache";

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
