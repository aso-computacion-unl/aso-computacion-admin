import { SignJWT } from "jose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { signSession, verifySession } from "@/infrastructure/auth/session-jwt";
import { OAUTH_STATE_MAX_AGE_SECONDS, openOAuthState, sealOAuthState, statesMatch } from "@/infrastructure/auth/oauth-state";

const SECRET = "s".repeat(40);
const FLOW = { state: "state-value", codeVerifier: "verifier-value", nonce: "nonce-value" };

describe("oauth state cookie", () => {
  beforeEach(() => vi.stubEnv("ADMIN_SECRET", SECRET));
  afterEach(() => vi.unstubAllEnvs());

  it("round-trips the state, the PKCE verifier and the nonce", async () => {
    expect(await openOAuthState(await sealOAuthState(FLOW))).toEqual(FLOW);
  });

  it("lives for a few minutes only", async () => {
    expect(OAUTH_STATE_MAX_AGE_SECONDS).toBeLessThanOrEqual(600);

    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      const sealed = await sealOAuthState(FLOW);
      vi.setSystemTime(Date.now() + (OAUTH_STATE_MAX_AGE_SECONDS + 10) * 1000);

      expect(await openOAuthState(sealed)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it.each([undefined, "", "not-a-jwt"])("opens %j as nothing", async (value) => {
    expect(await openOAuthState(value)).toBeNull();
  });

  it("refuses a tampered cookie and one signed with another secret", async () => {
    const sealed = await sealOAuthState(FLOW);

    expect(await openOAuthState(`${sealed}x`)).toBeNull();

    vi.stubEnv("ADMIN_SECRET", "o".repeat(40));
    expect(await openOAuthState(sealed)).toBeNull();
  });

  it("refuses a session token presented as the state cookie, and a state cookie is no session", async () => {
    expect(await openOAuthState(await signSession({ sid: "s", kind: "break_glass", uid: null, role: "ADMIN" }))).toBeNull();

    const now = Math.floor(Date.now() / 1000);
    const lookalike = await new SignJWT({ ...FLOW })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt(now)
      .setExpirationTime(now + 60)
      .sign(new TextEncoder().encode(SECRET));

    expect(await openOAuthState(lookalike)).toBeNull();
    expect((await verifySession(await sealOAuthState(FLOW))).valid).toBe(false);
  });

  it("is unavailable, not unsafe, when the signing secret is unusable", async () => {
    vi.stubEnv("ADMIN_SECRET", "short");

    await expect(sealOAuthState(FLOW)).rejects.toThrow();
    expect(await openOAuthState("anything")).toBeNull();
  });
});

describe("statesMatch", () => {
  it("compares the state in the URL with the one in the cookie", () => {
    expect(statesMatch("abc", "abc")).toBe(true);
    expect(statesMatch("abc", "abd")).toBe(false);
    expect(statesMatch("abc", "abcd")).toBe(false);
    expect(statesMatch(null, "abc")).toBe(false);
    expect(statesMatch("", "")).toBe(false);
  });
});
