import { SignJWT, jwtVerify } from "jose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const VALID_SECRET = "a".repeat(32);
const OTHER_SECRET = "b".repeat(32);
const SHORT_SECRET = "too-short";

describe("session-jwt", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("getSessionSecret", () => {
    it("SESSION-006: throws SessionSecretError when ADMIN_SECRET is short", async () => {
      vi.stubEnv("ADMIN_SECRET", SHORT_SECRET);

      const { getSessionSecret, SessionSecretError } = await import("@/infrastructure/auth/session-jwt");

      expect(() => getSessionSecret()).toThrow(SessionSecretError);
    });

    it("rejects the documented ADMIN_SECRET sentinel", async () => {
      vi.stubEnv("ADMIN_SECRET", "__REPLACE_ADMIN_SECRET__".padEnd(32, "_"));

      const { getSessionSecret, SessionSecretError } = await import("@/infrastructure/auth/session-jwt");

      expect(() => getSessionSecret()).toThrow(SessionSecretError);
    });

    it("rejects a whitespace-wrapped ADMIN_SECRET sentinel", async () => {
      vi.stubEnv("ADMIN_SECRET", `  ${"__REPLACE_ADMIN_SECRET__".padEnd(32, "_")}  `);

      const { getSessionSecret, SessionSecretError } = await import("@/infrastructure/auth/session-jwt");

      expect(() => getSessionSecret()).toThrow(SessionSecretError);
    });

    it("reports an invalid ADMIN_SECRET once without including its value", async () => {
      const secret = "  __REPLACE_ADMIN_SECRET__  ";
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
      const { reportSessionSecretMisconfiguration } = await import("@/infrastructure/auth/session-jwt");

      reportSessionSecretMisconfiguration();
      reportSessionSecretMisconfiguration();

      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledWith("ADMIN_SECRET is invalid; authentication is unavailable.");
      expect(errorSpy.mock.calls.flat()).not.toContain(secret);
    });
  });

  describe("signSession", () => {
    it("SESSION-001: returns a non-empty JWT with sub=admin and a 24h expiration", async () => {
      vi.stubEnv("ADMIN_SECRET", VALID_SECRET);

      const { signSession } = await import("@/infrastructure/auth/session-jwt");

      const token = await signSession();
      expect(token).toEqual(expect.any(String));
      expect(token.length).toBeGreaterThan(0);

      const { payload } = await jwtVerify(token, new TextEncoder().encode(VALID_SECRET));
      expect(payload.sub).toBe("admin");
      expect(payload.exp! - payload.iat!).toBe(86400);
    });

    it("SESSION-007: rejects with SessionSecretError when ADMIN_SECRET is short", async () => {
      vi.stubEnv("ADMIN_SECRET", SHORT_SECRET);

      const { signSession, SessionSecretError } = await import("@/infrastructure/auth/session-jwt");

      await expect(signSession()).rejects.toThrow(SessionSecretError);
    });
  });

  describe("verifySession", () => {
    it("SESSION-002: returns valid:true with the payload for a valid token", async () => {
      vi.stubEnv("ADMIN_SECRET", VALID_SECRET);

      const { signSession, verifySession } = await import("@/infrastructure/auth/session-jwt");

      const token = await signSession();
      const result = await verifySession(token);

      expect(result).toEqual({
        valid: true,
        payload: expect.objectContaining({ sub: "admin" }),
      });
    });

    it("SESSION-003: returns reason=expired for an expired token", async () => {
      vi.stubEnv("ADMIN_SECRET", VALID_SECRET);

      const { verifySession } = await import("@/infrastructure/auth/session-jwt");

      const now = Math.floor(Date.now() / 1000);
      const expiredToken = await new SignJWT({ sub: "admin" })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt(now - 200)
        .setExpirationTime(now - 100)
        .sign(new TextEncoder().encode(VALID_SECRET));

      const result = await verifySession(expiredToken);

      expect(result).toEqual({ valid: false, reason: "expired" });
    });

    it("SESSION-004: returns reason=invalid for a token signed with a different secret", async () => {
      vi.stubEnv("ADMIN_SECRET", VALID_SECRET);

      const { verifySession } = await import("@/infrastructure/auth/session-jwt");

      const now = Math.floor(Date.now() / 1000);
      const badToken = await new SignJWT({ sub: "admin" })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt(now)
        .setExpirationTime(now + 86400)
        .sign(new TextEncoder().encode(OTHER_SECRET));

      const result = await verifySession(badToken);

      expect(result).toEqual({ valid: false, reason: "invalid" });
    });

    it("SESSION-005: returns reason=bad-sub for a token with a non-admin subject", async () => {
      vi.stubEnv("ADMIN_SECRET", VALID_SECRET);

      const { verifySession } = await import("@/infrastructure/auth/session-jwt");

      const now = Math.floor(Date.now() / 1000);
      const hackerToken = await new SignJWT({ sub: "hacker" })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt(now)
        .setExpirationTime(now + 86400)
        .sign(new TextEncoder().encode(VALID_SECRET));

      const result = await verifySession(hackerToken);

      expect(result).toEqual({ valid: false, reason: "bad-sub" });
    });

    it("rejects a correctly signed token without an expiration", async () => {
      vi.stubEnv("ADMIN_SECRET", VALID_SECRET);

      const { verifySession } = await import("@/infrastructure/auth/session-jwt");
      const token = await new SignJWT({ sub: "admin" })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt(0)
        .sign(new TextEncoder().encode(VALID_SECRET));

      await expect(verifySession(token)).resolves.toEqual({ valid: false, reason: "invalid" });
    });

    it("SESSION-008: rejects with SessionSecretError when ADMIN_SECRET is invalid", async () => {
      vi.stubEnv("ADMIN_SECRET", SHORT_SECRET);

      const { verifySession, SessionSecretError } = await import("@/infrastructure/auth/session-jwt");

      await expect(verifySession("any.token.value")).rejects.toThrow(SessionSecretError);
    });

    it("returns reason=missing for an empty token", async () => {
      vi.stubEnv("ADMIN_SECRET", VALID_SECRET);

      const { verifySession } = await import("@/infrastructure/auth/session-jwt");

      const result = await verifySession("");

      expect(result).toEqual({ valid: false, reason: "missing" });
    });
  });
});

describe("session-cookies", () => {
  const setMock = vi.fn();

  beforeEach(() => {
    setMock.mockClear();
    vi.doMock("next/headers", () => ({
      cookies: vi.fn(async () => ({ set: setMock })),
    }));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.doUnmock("next/headers");
    vi.resetModules();
  });

  it("SESSION-009: setSessionCookie calls cookies().set with the correct flags", async () => {
    vi.stubEnv("NODE_ENV", "development");

    const { setSessionCookie } = await import("@/infrastructure/auth/session-cookies");
    const { AUTH_COOKIE_NAME } = await import("@/infrastructure/auth/session-jwt");

    await setSessionCookie("token-value");

    expect(setMock).toHaveBeenCalledWith(AUTH_COOKIE_NAME, "token-value", {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
      maxAge: 86400,
    });
  });

  it("SESSION-010: uses secure:true in production", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const { getCookieOptions } = await import("@/infrastructure/auth/session-cookies");

    expect(getCookieOptions().secure).toBe(true);
  });

  it("SESSION-011: uses secure:false in development", async () => {
    vi.stubEnv("NODE_ENV", "development");

    const { getCookieOptions } = await import("@/infrastructure/auth/session-cookies");

    expect(getCookieOptions().secure).toBe(false);
  });

  it("SESSION-012: clearSessionCookie calls cookies().set with maxAge:0 and path /", async () => {
    vi.stubEnv("NODE_ENV", "development");

    const { clearSessionCookie } = await import("@/infrastructure/auth/session-cookies");
    const { AUTH_COOKIE_NAME } = await import("@/infrastructure/auth/session-jwt");

    await clearSessionCookie();

    expect(setMock).toHaveBeenCalledWith(
      AUTH_COOKIE_NAME,
      "",
      expect.objectContaining({ maxAge: 0, path: "/" }),
    );
  });
});
