import "server-only";

import { getAuthServices } from "../../auth/auth-container";
import { requirePageSession } from "../../auth/require-page-session";

/** Every user, active or not, by email. ADMIN only. */
export async function getAdminUsers() {
  await requirePageSession("ADMIN");
  return getAuthServices().listUsers.execute();
}

/** Invites that can still be used (not used, revoked or expired), newest first. ADMIN only. */
export async function getPendingInvites() {
  await requirePageSession("ADMIN");
  return getAuthServices().listPendingInvites.execute();
}
