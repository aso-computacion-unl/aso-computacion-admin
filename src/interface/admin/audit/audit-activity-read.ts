import "server-only";

import { getAuthServices } from "../../auth/auth-container";
import { requirePageSession } from "../../auth/require-page-session";

/** Audit entries per day over the last 16 weeks, for the dashboard map: the team's for an ADMIN, their own for an EDITOR. */
export async function getAdminActivityByDay() {
  const actor = await requirePageSession("EDITOR");
  return getAuthServices().auditActivity.execute({ actor });
}
