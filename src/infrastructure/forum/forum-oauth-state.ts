import "server-only";

import { SignJWT, jwtVerify } from "jose";

import { getForumSecret } from "./forum-session-jwt";

export const FORUM_OAUTH_STATE_COOKIE_NAME = "forum_oauth_state";
export const FORUM_OAUTH_STATE_MAX_AGE_SECONDS = 600;

/** Marks the token as the forum login flow's: no session token (or admin flow token) opens as one. */
const PURPOSE = "forum-oauth-state";
const ALGORITHM = "HS256";

/** What the callback must find again: the `state` echoed in the URL, the PKCE verifier and the nonce in the ID token. */
export interface ForumOAuthFlow {
  state: string;
  codeVerifier: string;
  nonce: string;
}

/** The flow's secrets sealed into a short-lived cookie that only this browser sends back. Throws `ForumSecretError` without a usable secret. */
export async function sealForumOAuthState(flow: ForumOAuthFlow): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  return new SignJWT({ purpose: PURPOSE, ...flow })
    .setProtectedHeader({ alg: ALGORITHM })
    .setIssuedAt(now)
    .setExpirationTime(now + FORUM_OAUTH_STATE_MAX_AGE_SECONDS)
    .sign(getForumSecret());
}

/** The sealed flow, or null for anything missing, forged, expired or not a forum flow token. Never throws. */
export async function openForumOAuthState(value: string | undefined): Promise<ForumOAuthFlow | null> {
  if (!value) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(value, getForumSecret(), { algorithms: [ALGORITHM], requiredClaims: ["exp"] });
    const { purpose, state, codeVerifier, nonce } = payload;

    if (purpose !== PURPOSE || typeof state !== "string" || typeof codeVerifier !== "string" || typeof nonce !== "string") {
      return null;
    }

    return { state, codeVerifier, nonce };
  } catch {
    return null;
  }
}
