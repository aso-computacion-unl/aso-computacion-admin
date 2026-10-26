import "server-only";

import { getAuthServices } from "../../auth/auth-container";
import { requirePageSession } from "../../auth/require-page-session";

/** The sessions the actor may see (an admin's: everyone's; anyone else's: their own), and which one is this browser's. */
export async function getActiveSessions() {
  const actor = await requirePageSession();
  const sessions = await getAuthServices().listSessions.execute({ actor });

  return { actor, sessions: sessions.map((session) => ({ ...session, isCurrent: session.id === actor.sessionId })) };
}
