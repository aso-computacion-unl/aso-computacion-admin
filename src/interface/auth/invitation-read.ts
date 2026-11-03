import "server-only";

import type { Role } from "@/domain/user";
import { isInviteToken } from "@/infrastructure/auth/invite-token";

import { getAuthServices } from "./auth-container";

/**
 * What the public invitation page may say about a link: the invited email and role, and only while
 * the invite can still be used. A malformed token never reaches the database; an unknown, used,
 * revoked or expired one is the same `null`, so the page cannot tell them apart.
 */
export async function getInvitationForLink(token: string): Promise<{ email: string; role: Role } | null> {
  if (!isInviteToken(token)) {
    return null;
  }

  const invite = await getAuthServices().lookupInvite.execute(token);

  return invite ? { email: invite.email, role: invite.role } : null;
}
