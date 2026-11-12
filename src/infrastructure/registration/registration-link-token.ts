import "server-only";

import { SignJWT, errors, jwtVerify, type JWTPayload } from "jose";

import { registrationConfirmSecret } from "@/infrastructure/mail/mail-config";

/*
 * The signing both links of the registration emails share (confirm and cancel): one secret,
 * `REGISTRATION_CONFIRM_SECRET`, HS256, and a `purpose` claim per link so that a token of one kind never opens as the
 * other. Each link keeps its own module with its claims and lifetime; this is only the common part.
 */
const ALGORITHM = "HS256";

export class RegistrationConfirmSecretError extends Error {
  constructor() {
    super("REGISTRATION_CONFIRM_SECRET must be defined, differ from ADMIN_SECRET and FORUM_SESSION_SECRET and be at least 32 characters long.");
    this.name = "RegistrationConfirmSecretError";
  }
}

function secretKey(): Uint8Array {
  const secret = registrationConfirmSecret();

  if (!secret) {
    throw new RegistrationConfirmSecretError();
  }

  return new TextEncoder().encode(secret);
}

/** Signs `claims` with `purpose`, valid `ttlSeconds` from `now`. Throws `RegistrationConfirmSecretError` without a usable secret. */
export async function sealRegistrationLinkToken(purpose: string, claims: Record<string, string>, ttlSeconds: number, now: Date): Promise<string> {
  const issuedAt = Math.floor(now.getTime() / 1000);

  return new SignJWT({ purpose, ...claims })
    .setProtectedHeader({ alg: ALGORITHM })
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + ttlSeconds)
    .sign(secretKey());
}

export type RegistrationLinkPayload = JWTPayload & { rid: string; eid: string };

/**
 * The payload of a token of this `purpose` that names a registration (`rid`) and its event (`eid`); `expired` when it
 * was ours but too old, `invalid` for anything missing, forged or of another purpose. Throws
 * `RegistrationConfirmSecretError` only without a usable secret: then nothing can be checked, and the link is not to blame.
 */
export async function openRegistrationLinkToken(
  purpose: string,
  value: string | undefined,
  now: Date,
): Promise<{ status: "valid"; payload: RegistrationLinkPayload } | { status: "expired" | "invalid" }> {
  if (!value || !value.trim()) {
    return { status: "invalid" };
  }

  try {
    const { payload } = await jwtVerify(value.trim(), secretKey(), { algorithms: [ALGORITHM], requiredClaims: ["exp", "iat"], currentDate: now });
    const { rid, eid } = payload;

    if (payload.purpose !== purpose || typeof rid !== "string" || !rid || typeof eid !== "string" || !eid) {
      return { status: "invalid" };
    }

    return { status: "valid", payload: { ...payload, rid, eid } };
  } catch (error) {
    if (error instanceof RegistrationConfirmSecretError) throw error;

    return { status: error instanceof errors.JWTExpired ? "expired" : "invalid" };
  }
}
