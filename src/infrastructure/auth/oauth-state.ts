import "server-only";
import { timingSafeEqual } from "node:crypto";

import { SignJWT, jwtVerify } from "jose";

import { SESSION_ALGORITHM, getSessionSecret } from "./session-jwt";

export const OAUTH_STATE_COOKIE_NAME = "oauth_state";
export const OAUTH_STATE_MAX_AGE_SECONDS = 600;

/** Marks the token as the OAuth flow's, so a session token can never be opened as one (and the reverse: it has no `sid`). */
const PURPOSE = "oauth-state";

/** What the callback must find again: the `state` echoed in the URL, the PKCE verifier and the nonce in the ID token. */
export interface OAuthFlow {
  state: string;
  codeVerifier: string;
  nonce: string;
}

/**
 * The flow's secrets, sealed (signed, short lived) into a cookie that only this browser sends back:
 * the callback checks the URL's `state` against it, which is what ties the callback to the browser
 * that started the login. Throws when the signing secret is unusable.
 */
export async function sealOAuthState(flow: OAuthFlow): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  return new SignJWT({ purpose: PURPOSE, ...flow })
    .setProtectedHeader({ alg: SESSION_ALGORITHM })
    .setIssuedAt(now)
    .setExpirationTime(now + OAUTH_STATE_MAX_AGE_SECONDS)
    .sign(getSessionSecret());
}

/** The sealed flow, or null for anything missing, forged, expired or not a flow token. Never throws. */
export async function openOAuthState(value: string | undefined): Promise<OAuthFlow | null> {
  if (!value) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(value, getSessionSecret(), { algorithms: [SESSION_ALGORITHM], requiredClaims: ["exp"] });
    const { purpose, state, codeVerifier, nonce } = payload;

    if (purpose !== PURPOSE || typeof state !== "string" || typeof codeVerifier !== "string" || typeof nonce !== "string") {
      return null;
    }

    return { state, codeVerifier, nonce };
  } catch {
    return null;
  }
}

/** Constant-time comparison of the `state` in the URL with the one in the cookie. */
export function statesMatch(fromUrl: string | null, fromCookie: string): boolean {
  if (!fromUrl || !fromCookie || fromUrl.length !== fromCookie.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(fromUrl), Buffer.from(fromCookie));
}
