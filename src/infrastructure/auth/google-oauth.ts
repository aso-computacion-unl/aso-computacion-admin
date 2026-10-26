import "server-only";

import { ArcticFetchError, UnexpectedResponseError, generateCodeVerifier, generateState, Google } from "arctic";
import { createRemoteJWKSet, errors, jwtVerify, type JWTVerifyGetKey } from "jose";

import type { GoogleConfig } from "./auth-config";

/**
 * Google sign-in: authorization code flow with PKCE (S256), a `state` and a `nonce`, done on the server.
 *
 * `arctic` builds the authorization URL and exchanges the code (a small, maintained, fetch-based
 * client with no framework around it). It deliberately does not verify the ID token's signature,
 * so this module does, with `jose` against Google's published keys: signature, issuer, audience,
 * expiry and nonce, and `email_verified` is carried through for the login rule to enforce.
 */
const SCOPES = ["openid", "email", "profile"];
const ISSUERS = ["https://accounts.google.com", "accounts.google.com"];
const GOOGLE_JWKS_URL = new URL("https://www.googleapis.com/oauth2/v3/certs");

let remoteJwks: JWTVerifyGetKey | undefined;

/** Google's signing keys, fetched and cached by `jose` (re-fetched when a new `kid` shows up). */
function googleJwks(): JWTVerifyGetKey {
  remoteJwks ??= createRemoteJWKSet(GOOGLE_JWKS_URL);
  return remoteJwks;
}

/**
 * Why a sign-in failed, as a fixed code: the message never carries the code, a token or a secret.
 * `unavailable` is Google (or the network to it) being down: nothing about the person was judged, so
 * it is the one failure worth retrying.
 */
export type GoogleAuthFailure = "exchange" | "token" | "claims" | "unavailable";

export class GoogleAuthError extends Error {
  constructor(public readonly failure: GoogleAuthFailure) {
    super(`Google sign-in failed (${failure})`);
    this.name = "GoogleAuthError";
  }
}

/** The token endpoint unreachable, or answering 5xx. Other answers (a bad or reused code) are the person's. */
function isTokenEndpointOutage(error: unknown): boolean {
  return error instanceof ArcticFetchError || (error instanceof UnexpectedResponseError && error.status >= 500);
}

const KEY_SET_OUTAGE_CODES: ReadonlySet<string> = new Set([errors.JOSEError.code, errors.JWKSTimeout.code, errors.JWKSInvalid.code]);

/**
 * Fetching Google's keys failed (network error, timeout, non-200, unusable key set). A bad token
 * always fails with a specific `jose` error (signature, claims, malformed), never with these.
 */
function isKeySetOutage(error: unknown): boolean {
  return !(error instanceof errors.JOSEError) || KEY_SET_OUTAGE_CODES.has(error.code);
}

export interface OAuthStart {
  url: URL;
  state: string;
  codeVerifier: string;
  nonce: string;
}

export function startGoogleAuthorization(config: GoogleConfig): OAuthStart {
  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  const nonce = generateState();
  const url = new Google(config.clientId, config.clientSecret, config.redirectUri).createAuthorizationURL(state, codeVerifier, SCOPES);

  url.searchParams.set("nonce", nonce);

  return { url, state, codeVerifier, nonce };
}

export interface GoogleIdentity {
  email: string;
  /** True only when Google's token says `email_verified: true`. */
  emailVerified: boolean;
  name?: string;
  /** Google's `hd` claim: the Workspace domain of the account. Absent for a personal account. */
  hostedDomain?: string;
}

interface AuthorizationClient {
  validateAuthorizationCode(code: string, codeVerifier: string): Promise<{ idToken(): string }>;
}

export interface CompleteGoogleAuthorization {
  client: AuthorizationClient;
  clientId: string;
  code: string;
  codeVerifier: string;
  nonce: string;
  /** Google's keys; only tests pass their own. */
  jwks?: JWTVerifyGetKey;
}

export function googleClient(config: GoogleConfig): AuthorizationClient {
  return new Google(config.clientId, config.clientSecret, config.redirectUri);
}

/** Exchanges the code (with the PKCE verifier) and returns the identity of a fully validated ID token. */
export async function completeGoogleAuthorization(input: CompleteGoogleAuthorization): Promise<GoogleIdentity> {
  let token: string;

  try {
    token = (await input.client.validateAuthorizationCode(input.code, input.codeVerifier)).idToken();
  } catch (error) {
    throw new GoogleAuthError(isTokenEndpointOutage(error) ? "unavailable" : "exchange");
  }

  let payload: Record<string, unknown>;

  try {
    ({ payload } = await jwtVerify(token, input.jwks ?? googleJwks(), {
      issuer: ISSUERS,
      audience: input.clientId,
      algorithms: ["RS256"],
      clockTolerance: 5,
      requiredClaims: ["exp", "iat"],
    }));
  } catch (error) {
    throw new GoogleAuthError(isKeySetOutage(error) ? "unavailable" : "token");
  }

  if (typeof payload.nonce !== "string" || payload.nonce !== input.nonce || typeof payload.email !== "string" || payload.email === "") {
    throw new GoogleAuthError("claims");
  }

  return {
    email: payload.email,
    emailVerified: payload.email_verified === true,
    ...(typeof payload.name === "string" ? { name: payload.name } : {}),
    ...(typeof payload.hd === "string" ? { hostedDomain: payload.hd } : {}),
  };
}
