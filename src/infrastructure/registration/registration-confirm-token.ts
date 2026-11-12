import "server-only";

import { REGISTRATION_CONFIRMATION_TTL_MS } from "@/domain/event-registration";

import { openRegistrationLinkToken, sealRegistrationLinkToken } from "./registration-link-token";

export { RegistrationConfirmSecretError } from "./registration-link-token";

/*
 * The link in the confirmation email carries this token. Its own secret (`REGISTRATION_CONFIRM_SECRET`, never equal to
 * the admin's or the forum's) and its own `purpose`, so neither a session token nor any other signed value opens as one.
 * It names the pending registration and its event and lives as long as the confirmation window (48 h). It proves the
 * link came from us, not that the seat is still free: the repository decides that when the person confirms.
 * It also names the attempt (`nce`, a nonce stored on the pending row): registering the same email again replaces the
 * nonce, so only the link of the latest attempt confirms. A token without one is a link sent before that existed.
 */
const PURPOSE = "registration-confirm";

export const REGISTRATION_CONFIRM_TTL_SECONDS = REGISTRATION_CONFIRMATION_TTL_MS / 1000;

export interface RegistrationConfirmClaims {
  registrationId: string;
  eventId: string;
  /** The attempt the link was issued for; absent on a link sent before attempts were tracked. */
  nonce?: string;
}

export type RegistrationConfirmTokenResult = { status: "valid"; claims: RegistrationConfirmClaims } | { status: "expired" | "invalid" };

/** The signed token for one pending registration, valid 48 h from `now`. Throws `RegistrationConfirmSecretError` without a usable secret. */
export function sealRegistrationConfirmToken({ registrationId, eventId, nonce }: RegistrationConfirmClaims, now: Date = new Date()): Promise<string> {
  return sealRegistrationLinkToken(PURPOSE, { rid: registrationId, eid: eventId, ...(nonce ? { nce: nonce } : {}) }, REGISTRATION_CONFIRM_TTL_SECONDS, now);
}

/**
 * What the token says, `expired` when it was ours but too old, `invalid` for anything missing, forged or not a
 * confirmation token. Throws `RegistrationConfirmSecretError` only without a usable secret: then nothing can be
 * checked, and the link is not to blame (the endpoint answers 503 `unavailable`).
 */
export async function openRegistrationConfirmToken(value: string | undefined, now: Date = new Date()): Promise<RegistrationConfirmTokenResult> {
  const token = await openRegistrationLinkToken(PURPOSE, value, now);

  if (token.status !== "valid") {
    return token;
  }

  const { rid, eid, nce } = token.payload;

  if (nce === undefined) {
    return { status: "valid", claims: { registrationId: rid, eventId: eid } };
  }

  return typeof nce === "string" && nce ? { status: "valid", claims: { registrationId: rid, eventId: eid, nonce: nce } } : { status: "invalid" };
}
