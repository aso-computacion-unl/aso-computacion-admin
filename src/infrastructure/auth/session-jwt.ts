import { SignJWT, errors, jwtVerify } from "jose";

import type { Role, SessionKind } from "@/domain/user";
import { requireRuntimeValue } from "@/infrastructure/config/runtime-env";

export const AUTH_COOKIE_NAME = "admin_session";
export const SESSION_DURATION_SECONDS = 86400;

export const SESSION_ALGORITHM = "HS256";

let hasReportedSessionSecretMisconfiguration = false;

export class SessionSecretError extends Error {
  constructor(message = "ADMIN_SECRET must be defined and at least 32 characters long.") {
    super(message);
    this.name = "SessionSecretError";
  }
}

export function reportSessionSecretMisconfiguration(): void {
  if (hasReportedSessionSecretMisconfiguration) {
    return;
  }

  hasReportedSessionSecretMisconfiguration = true;
  console.error("ADMIN_SECRET is invalid; authentication is unavailable.");
}

/** Subject of a break-glass token: it names no account. */
export const BREAK_GLASS_SUBJECT = "break_glass";

/**
 * What the cookie says about the session. It only locates the `Session` row; the guard takes the
 * actor's role and whether the session is still good from the database, so `role` here is a hint
 * (the middleware cannot reach the database) and is never trusted for authorization.
 */
export interface SessionClaims {
  sid: string;
  kind: SessionKind;
  uid: string | null;
  role: Role;
}

export interface SessionPayload extends SessionClaims {
  sub: string;
  iat: number;
  exp: number;
}

export type SessionResult =
  | { valid: true; payload: SessionPayload }
  | { valid: false; reason: "missing" | "invalid" | "expired" | "bad-claims" };

function hasValidClaims(payload: Record<string, unknown>): boolean {
  const { sub, sid, kind, uid, role } = payload;

  if (typeof sid !== "string" || sid === "" || (role !== "ADMIN" && role !== "EDITOR")) {
    return false;
  }

  if (kind === "break_glass") {
    return sub === BREAK_GLASS_SUBJECT && uid === undefined;
  }

  return kind === "user" && typeof uid === "string" && uid !== "" && sub === uid;
}

export function getSessionSecret(): Uint8Array {
  let secret: string;

  try {
    secret = requireRuntimeValue("ADMIN_SECRET", process.env.ADMIN_SECRET);
  } catch {
    throw new SessionSecretError();
  }

  if (secret.length < 32) {
    throw new SessionSecretError();
  }

  return new TextEncoder().encode(secret);
}

export async function signSession({ sid, kind, uid, role }: SessionClaims): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  return new SignJWT({ sid, kind, role, ...(uid === null ? {} : { uid }) })
    .setSubject(uid ?? BREAK_GLASS_SUBJECT)
    .setProtectedHeader({ alg: SESSION_ALGORITHM })
    .setIssuedAt(now)
    .setExpirationTime(now + SESSION_DURATION_SECONDS)
    .sign(getSessionSecret());
}

export async function verifySession(token: string): Promise<SessionResult> {
  if (!token) {
    return { valid: false, reason: "missing" };
  }

  try {
    const { payload } = await jwtVerify(token, getSessionSecret(), {
      algorithms: [SESSION_ALGORITHM],
      clockTolerance: 5,
      requiredClaims: ["exp"],
    });

    if (!hasValidClaims(payload)) {
      return { valid: false, reason: "bad-claims" };
    }

    return { valid: true, payload: { ...payload, uid: payload.uid ?? null } as unknown as SessionPayload };
  } catch (error) {
    if (error instanceof SessionSecretError) {
      throw error;
    }

    if (error instanceof errors.JWTExpired) {
      return { valid: false, reason: "expired" };
    }

    return { valid: false, reason: "invalid" };
  }
}
