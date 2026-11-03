import type { Role } from "./user";

/** How long an invite link works after it is created. */
export const INVITE_TTL_DAYS = 7;
const INVITE_TTL_MS = INVITE_TTL_DAYS * 24 * 60 * 60 * 1000;

/**
 * A single-use link that lets one person into the admin with the role an ADMIN chose (S11). It is
 * bound to one email: only a Google account with that email can redeem it. The link's token is never
 * kept, only its hash, which the repository holds and this shape does not carry.
 */
export interface AdminInvite {
  id: string;
  /** Lower-cased, like a user's email. */
  email: string;
  role: Role;
  /** The ADMIN who created it; null for the emergency login, which has no account. */
  createdById: string | null;
  createdAt: Date;
  expiresAt: Date;
  usedAt: Date | null;
  usedByUserId: string | null;
  revokedAt: Date | null;
}

export type AdminInviteState = "pending" | "used" | "revoked" | "expired";

export function inviteExpiry(createdAt: Date): Date {
  return new Date(createdAt.getTime() + INVITE_TTL_MS);
}

/** Used and revoked win over expired: they say what happened to the link, expiry only that time ran out. */
export function adminInviteState(invite: Pick<AdminInvite, "usedAt" | "revokedAt" | "expiresAt">, now: Date): AdminInviteState {
  if (invite.usedAt) return "used";
  if (invite.revokedAt) return "revoked";
  return invite.expiresAt.getTime() > now.getTime() ? "pending" : "expired";
}
