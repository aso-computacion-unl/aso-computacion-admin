import "server-only";
import { createHash, randomBytes } from "node:crypto";

import type { InviteTokens } from "@/application/auth/admin-invite.use-cases";

/** 32 random bytes in base64url: 43 characters, no padding. */
const INVITE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/** True for something shaped like an invite token. Anything else is refused before it is hashed or stored. */
export function isInviteToken(value: unknown): value is string {
  return typeof value === "string" && INVITE_TOKEN_PATTERN.test(value);
}

/**
 * 256 random bits make the token unguessable, so a plain SHA-256 (no salt, no slow hash) is enough to
 * keep a database leak from turning into working links, and still lets the link be looked up by hash.
 */
export const inviteTokens: InviteTokens = {
  generate: () => randomBytes(32).toString("base64url"),
  hash: (token) => createHash("sha256").update(token).digest("hex"),
};
