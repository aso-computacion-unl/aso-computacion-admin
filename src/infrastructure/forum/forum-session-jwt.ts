import "server-only";

import { SignJWT, errors, jwtVerify } from "jose";

import { forumSessionSecret } from "./forum-config";

/*
 * The forum's session token. It is deliberately a different kind of token from the admin's:
 *  - its own secret (`FORUM_SESSION_SECRET`, never equal to `ADMIN_SECRET`),
 *  - its own claims (`mid`, `typ`, `aud`), none of which an admin token carries and none of the admin's
 *    (`kind`, `uid`, `role`) present here, so neither verifier accepts the other's token even if the
 *    secrets were ever misconfigured to match,
 *  - its own cookie, scoped to `/foro`, which the browser never sends to `/admin`.
 * The admin session module is not touched by any of this.
 */
export const FORUM_COOKIE_NAME = "forum_session";
export const FORUM_COOKIE_PATH = "/foro";
export const FORUM_SESSION_DURATION_SECONDS = 7 * 24 * 60 * 60;
export const FORUM_AUDIENCE = "aso-computacion-forum";
export const FORUM_SESSION_TYPE = "forum-session";

const ALGORITHM = "HS256";

export class ForumSecretError extends Error {
  constructor() {
    super("FORUM_SESSION_SECRET must be defined, differ from ADMIN_SECRET and be at least 32 characters long.");
    this.name = "ForumSecretError";
  }
}

/** The signing key, or `ForumSecretError`: with no usable secret nothing is signed or accepted. */
export function getForumSecret(): Uint8Array {
  const secret = forumSessionSecret();

  if (!secret) {
    throw new ForumSecretError();
  }

  return new TextEncoder().encode(secret);
}

export interface ForumSessionClaims {
  /** The `ForumSession` row this cookie names. */
  sid: string;
  memberId: string;
}

export type ForumSessionResult =
  | { valid: true; payload: ForumSessionClaims }
  | { valid: false; reason: "missing" | "invalid" | "expired" | "bad-claims" };

export async function signForumSession({ sid, memberId }: ForumSessionClaims): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  return new SignJWT({ sid, mid: memberId, typ: FORUM_SESSION_TYPE })
    .setSubject(memberId)
    .setAudience(FORUM_AUDIENCE)
    .setProtectedHeader({ alg: ALGORITHM })
    .setIssuedAt(now)
    .setExpirationTime(now + FORUM_SESSION_DURATION_SECONDS)
    .sign(getForumSecret());
}

export async function verifyForumSession(token: string): Promise<ForumSessionResult> {
  if (!token) {
    return { valid: false, reason: "missing" };
  }

  try {
    const { payload } = await jwtVerify(token, getForumSecret(), {
      algorithms: [ALGORITHM],
      audience: FORUM_AUDIENCE,
      clockTolerance: 5,
      requiredClaims: ["exp"],
    });
    const { sid, mid, typ, sub } = payload;

    if (typ !== FORUM_SESSION_TYPE || typeof sid !== "string" || sid === "" || typeof mid !== "string" || mid === "" || sub !== mid) {
      return { valid: false, reason: "bad-claims" };
    }

    return { valid: true, payload: { sid, memberId: mid } };
  } catch (error) {
    if (error instanceof ForumSecretError) {
      throw error;
    }

    if (error instanceof errors.JWTExpired) {
      return { valid: false, reason: "expired" };
    }

    // A wrong audience is a token that is not the forum's at all.
    return { valid: false, reason: error instanceof errors.JWTClaimValidationFailed ? "bad-claims" : "invalid" };
  }
}
