import "server-only";

import { REGISTRATION_CANCEL_TTL_MS } from "@/domain/event-registration";

import { openRegistrationLinkToken, sealRegistrationLinkToken } from "./registration-link-token";

/*
 * The link that cancels a registration (D7), in the confirmation and the reminder emails. Signed with the same secret
 * as the confirmation link (`REGISTRATION_CONFIRM_SECRET`, never equal to the admin's or the forum's) but with its own
 * `purpose`, so a cancel token never confirms and a confirm token never cancels. It names the registration and its
 * event, nothing else: it proves the link came from us for that person's registration, and the repository decides
 * whether the event still lets it go. It lives a year, as long as there can be something to cancel.
 */
const PURPOSE = "registration-cancel";

export const REGISTRATION_CANCEL_TTL_SECONDS = REGISTRATION_CANCEL_TTL_MS / 1000;

export interface RegistrationCancelClaims {
  registrationId: string;
  eventId: string;
}

export type RegistrationCancelTokenResult = { status: "valid"; claims: RegistrationCancelClaims } | { status: "expired" | "invalid" };

/** The signed token for one registration, valid a year from `now`. Throws `RegistrationConfirmSecretError` without a usable secret. */
export function sealRegistrationCancelToken({ registrationId, eventId }: RegistrationCancelClaims, now: Date = new Date()): Promise<string> {
  return sealRegistrationLinkToken(PURPOSE, { rid: registrationId, eid: eventId }, REGISTRATION_CANCEL_TTL_SECONDS, now);
}

/**
 * What the token says, `expired` when it was ours but too old, `invalid` for anything missing, forged or not a
 * cancellation token. Throws `RegistrationConfirmSecretError` only without a usable secret: then nothing can be
 * checked, and the link is not to blame (the endpoint answers 503 `unavailable`).
 */
export async function openRegistrationCancelToken(value: string | undefined, now: Date = new Date()): Promise<RegistrationCancelTokenResult> {
  const token = await openRegistrationLinkToken(PURPOSE, value, now);

  return token.status === "valid" ? { status: "valid", claims: { registrationId: token.payload.rid, eventId: token.payload.eid } } : token;
}
