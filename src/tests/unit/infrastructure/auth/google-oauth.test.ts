import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair, type JWK } from "jose";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { GoogleAuthError, completeGoogleAuthorization, startGoogleAuthorization } from "@/infrastructure/auth/google-oauth";

const CONFIG = { clientId: "client-id.apps.googleusercontent.com", clientSecret: "client-secret-value", redirectUri: "https://admin.example.org/auth/google/callback" };
const NONCE = "the-nonce";

let signingKey: CryptoKey;
let otherKey: CryptoKey;
let jwks: ReturnType<typeof createLocalJWKSet>;

beforeAll(async () => {
  const pair = await generateKeyPair("RS256");
  const other = await generateKeyPair("RS256");
  signingKey = pair.privateKey;
  otherKey = other.privateKey;
  const jwk: JWK = { ...(await exportJWK(pair.publicKey)), alg: "RS256", use: "sig", kid: "k1" };
  jwks = createLocalJWKSet({ keys: [jwk] });
});

interface TokenOptions {
  claims?: Record<string, unknown>;
  issuer?: string;
  audience?: string;
  expiresIn?: number;
  key?: () => CryptoKey;
}

async function idToken({ claims = {}, issuer = "https://accounts.google.com", audience = CONFIG.clientId, expiresIn = 3600, key = () => signingKey }: TokenOptions = {}) {
  const now = Math.floor(Date.now() / 1000);

  return new SignJWT({ email: "ana@example.org", email_verified: true, name: "Ana Pérez", nonce: NONCE, ...claims })
    .setProtectedHeader({ alg: "RS256", kid: "k1" })
    .setIssuer(issuer)
    .setAudience(audience)
    .setSubject("google-sub")
    .setIssuedAt(now - 10)
    .setExpirationTime(now + expiresIn)
    .sign(key());
}

function fakeGoogle(token: string | Error) {
  const validateAuthorizationCode = vi.fn(async () => {
    if (token instanceof Error) throw token;

    return { idToken: () => token };
  });

  return { client: { validateAuthorizationCode }, validateAuthorizationCode };
}

const complete = (token: string | Error, overrides: { nonce?: string } = {}) => {
  const google = fakeGoogle(token);

  return { google, result: completeGoogleAuthorization({ client: google.client, jwks, clientId: CONFIG.clientId, code: "auth-code", codeVerifier: "verifier", nonce: overrides.nonce ?? NONCE }) };
};

describe("startGoogleAuthorization", () => {
  it("builds an authorization-code request with PKCE (S256), state and nonce, and no secret in the URL", () => {
    const { url, state, codeVerifier, nonce } = startGoogleAuthorization(CONFIG);

    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      client_id: CONFIG.clientId,
      redirect_uri: CONFIG.redirectUri,
      response_type: "code",
      scope: "openid email profile",
      state,
      nonce,
      code_challenge_method: "S256",
    });
    expect(url.searchParams.get("code_challenge")).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(url.toString()).not.toContain(CONFIG.clientSecret);
    expect(url.toString()).not.toContain(codeVerifier);
  });

  it("uses fresh, unguessable values on every start", () => {
    const first = startGoogleAuthorization(CONFIG);
    const second = startGoogleAuthorization(CONFIG);

    expect(first.state).not.toBe(second.state);
    expect(first.nonce).not.toBe(second.nonce);
    expect(first.codeVerifier).not.toBe(second.codeVerifier);
    expect(new Set([first.state, first.nonce, first.codeVerifier]).size).toBe(3);
    expect(first.state.length).toBeGreaterThanOrEqual(20);
    expect(first.codeVerifier.length).toBeGreaterThanOrEqual(43);
  });
});

describe("completeGoogleAuthorization", () => {
  it("exchanges the code with the PKCE verifier and returns the verified identity", async () => {
    const { google, result } = complete(await idToken());

    expect(await result).toEqual({ email: "ana@example.org", emailVerified: true, name: "Ana Pérez" });
    expect(google.validateAuthorizationCode).toHaveBeenCalledWith("auth-code", "verifier");
  });

  it("accepts the legacy issuer without the scheme", async () => {
    const { result } = complete(await idToken({ issuer: "accounts.google.com" }));

    await expect(result).resolves.toMatchObject({ email: "ana@example.org" });
  });

  it("reports an email Google did not verify as unverified, so the login use case refuses it", async () => {
    const { result } = complete(await idToken({ claims: { email_verified: false } }));

    expect((await result).emailVerified).toBe(false);
  });

  it("treats a missing or non-boolean email_verified as unverified", async () => {
    expect((await complete(await idToken({ claims: { email_verified: undefined } })).result).emailVerified).toBe(false);
    expect((await complete(await idToken({ claims: { email_verified: "true" } })).result).emailVerified).toBe(false);
  });

  it.each([
    ["a token for another client (audience)", () => idToken({ audience: "someone-else" })],
    ["a token from another issuer", () => idToken({ issuer: "https://evil.example" })],
    ["an expired token", () => idToken({ expiresIn: -3600 })],
    ["a token signed with a key that is not in Google's key set", () => idToken({ key: () => otherKey })],
    ["a token with another nonce (replay)", () => idToken({ claims: { nonce: "another" } })],
    ["a token without a nonce", () => idToken({ claims: { nonce: undefined } })],
    ["a token without an email", () => idToken({ claims: { email: undefined } })],
    ["a token whose email is not a string", () => idToken({ claims: { email: 42 } })],
  ])("rejects %s", async (_label, make) => {
    const { result } = complete(await make());

    await expect(result).rejects.toBeInstanceOf(GoogleAuthError);
  });

  it("rejects an unsigned token", async () => {
    const [header, payload] = (await idToken()).split(".");
    const unsigned = `${Buffer.from(JSON.stringify({ alg: "none" })).toString("base64url")}.${payload}.`;

    expect(header).toBeDefined();
    await expect(complete(unsigned).result).rejects.toBeInstanceOf(GoogleAuthError);
  });

  it("rejects when the code exchange fails, without carrying the code or the secret in the error", async () => {
    const { result } = complete(new Error("invalid_grant auth-code client-secret-value"));
    const error = await result.catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(GoogleAuthError);
    expect(String((error as Error).message)).not.toMatch(/auth-code|client-secret-value/);
  });

  it("rejects when Google returns no ID token", async () => {
    const google = { validateAuthorizationCode: vi.fn(async () => ({ idToken: () => { throw new Error("missing id_token"); } })) };

    await expect(completeGoogleAuthorization({ client: google, jwks, clientId: CONFIG.clientId, code: "c", codeVerifier: "v", nonce: NONCE })).rejects.toBeInstanceOf(GoogleAuthError);
  });
});
