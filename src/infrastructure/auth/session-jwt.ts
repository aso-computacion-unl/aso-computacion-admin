import { SignJWT, errors, jwtVerify } from "jose";

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

/**
 * Test-only helper. Resets the process-level "reported once" latch so suites can
 * assert the report-once behavior in isolation. Not intended for production use.
 */
export function resetSessionSecretMisconfigurationReport(): void {
  hasReportedSessionSecretMisconfiguration = false;
}

export interface SessionPayload {
  sub: "admin";
  iat: number;
  exp: number;
}

export type SessionResult =
  | { valid: true; payload: SessionPayload }
  | { valid: false; reason: "missing" | "invalid" | "expired" | "bad-sub" };

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

export async function signSession(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  return new SignJWT({ sub: "admin" })
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

    if (payload.sub !== "admin") {
      return { valid: false, reason: "bad-sub" };
    }

    return { valid: true, payload: payload as unknown as SessionPayload };
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
