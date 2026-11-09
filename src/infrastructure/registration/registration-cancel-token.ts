import "server-only";

import { SignJWT, errors, jwtVerify } from "jose";

import { REGISTRATION_CANCEL_TTL_MS } from "@/domain/event-registration";
import { registrationConfirmSecret } from "@/infrastructure/mail/mail-config";
import { RegistrationConfirmSecretError } from "@/infrastructure/registration/registration-confirm-token";

/*
 * The link that cancels a registration (D7), in the confirmation and the reminder emails. Signed with the same secret
 * as the confirmation link (`REGISTRATION_CONFIRM_SECRET`, never equal to the admin's or the forum's) but with its own
 * `purpose`, so a cancel token never confirms and a confirm token never cancels. It names the registration and its
 * event, nothing else: it proves the link came from us for that person's registration, and the repository decides
 * whether the event still lets it go. It lives a year, as long as there can be something to cancel.
 */
const PURPOSE = "registration-cancel";
const ALGORITHM = "HS256";

export const REGISTRATION_CANCEL_TTL_SECONDS = REGISTRATION_CANCEL_TTL_MS / 1000;

export interface RegistrationCancelClaims {
  registrationId: string;
  eventId: string;
}

export type RegistrationCancelTokenResult = { status: "valid"; claims: RegistrationCancelClaims } | { status: "expired" | "invalid" };

function secretKey(): Uint8Array {
  const secret = registrationConfirmSecret();

  if (!secret) {
    throw new RegistrationConfirmSecretError();
  }

  return new TextEncoder().encode(secret);
}

/** The signed token for one registration, valid a year from `now`. Throws `RegistrationConfirmSecretError` without a usable secret. */
export async function sealRegistrationCancelToken({ registrationId, eventId }: RegistrationCancelClaims, now: Date = new Date()): Promise<string> {
  const issuedAt = Math.floor(now.getTime() / 1000);

  return new SignJWT({ purpose: PURPOSE, rid: registrationId, eid: eventId })
    .setProtectedHeader({ alg: ALGORITHM })
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + REGISTRATION_CANCEL_TTL_SECONDS)
    .sign(secretKey());
}

/** What the token says, `expired` when it was ours but too old, `invalid` for anything missing, forged or not a cancellation token. Never throws. */
export async function openRegistrationCancelToken(value: string | undefined, now: Date = new Date()): Promise<RegistrationCancelTokenResult> {
  if (!value || !value.trim()) {
    return { status: "invalid" };
  }

  try {
    const { payload } = await jwtVerify(value.trim(), secretKey(), { algorithms: [ALGORITHM], requiredClaims: ["exp", "iat"], currentDate: now });
    const { purpose, rid, eid } = payload;

    if (purpose !== PURPOSE || typeof rid !== "string" || !rid || typeof eid !== "string" || !eid) {
      return { status: "invalid" };
    }

    return { status: "valid", claims: { registrationId: rid, eventId: eid } };
  } catch (error) {
    return { status: error instanceof errors.JWTExpired ? "expired" : "invalid" };
  }
}
