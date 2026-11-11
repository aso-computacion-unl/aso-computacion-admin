import "server-only";

import { SignJWT, errors, jwtVerify } from "jose";

import { forumSessionSecret } from "./forum-config";

/*
 * The forum's session token. It is deliberately a different kind of token from the admin's:
 *  - its own secret (`FORUM_SESSION_SECRET`, never equal to `ADMIN_SECRET`),
 *  - its own claims (`mid`, `typ`, `aud`), none of which an admin token carries and none of the admin's
 *    (`kind`, `uid`, `role`) present here, so neither verifier accepts the other's token even if the
 *    secrets were ever misconfigured to match,
 *  - its own cookie (`forum_sid`), which the admin guard never reads.
 * The admin session module is not touched by any of this.
 *
 * The cookie covers the whole site (`/`), not just `/foro`: the event registration page lives at
 * `/inscripciones/<slug>` and needs the same session. Until 2026-11 it was `forum_session` on `/foro`; that
 * legacy cookie is moved to the new one by the proxy (see `migrateLegacyForumCookie`) and expired on logout.
 */
export const FORUM_COOKIE_NAME = "forum_sid";
export const FORUM_COOKIE_PATH = "/";
export const LEGACY_FORUM_COOKIE_NAME = "forum_session";
export const LEGACY_FORUM_COOKIE_PATH = "/foro";
/** 30 days, the same as the `ForumSession` row (`FORUM_SESSION_TTL_MS`); the admin session stays at 24 hours. */
export const FORUM_SESSION_DURATION_SECONDS = 30 * 24 * 60 * 60;
export const FORUM_AUDIENCE = "aso-computacion-forum";
export const FORUM_SESSION_TYPE = "forum-session";

const ALGORITHM = "HS256";

/** The attributes of the forum cookies, new and legacy: one place, so a cookie set and the one that expires it agree. */
export function forumCookieOptions(path: string, maxAge: number) {
  return { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path, maxAge };
}

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
