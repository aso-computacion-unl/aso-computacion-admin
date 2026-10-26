import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { cookieSetMock, cookieGetMock, headersGetMock, reportError } = vi.hoisted(() => ({
  reportError: vi.fn(),
  cookieSetMock: vi.fn(),
  cookieGetMock: vi.fn(),
  headersGetMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/infrastructure/observability/report-error", () => ({ reportError }));
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ set: cookieSetMock, get: cookieGetMock })),
  headers: vi.fn(async () => ({ get: headersGetMock })),
}));

import { AUTH_COOKIE_NAME, verifySession } from "@/infrastructure/auth/session-jwt";
import { closeSession, openSession } from "@/interface/auth/session-lifecycle";
import { signInAs, testAuth } from "@/tests/support/test-auth";

const sessionCookie = () => cookieSetMock.mock.calls.find(([name]) => name === AUTH_COOKIE_NAME) as [string, string, Record<string, unknown>];

describe("session lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("ADMIN_SECRET", "a".repeat(32));
    cookieGetMock.mockReturnValue(undefined);
    headersGetMock.mockImplementation((name: string) => ({ "x-real-ip": "203.0.113.5", "user-agent": "Mozilla/5.0 Test" })[name] ?? null);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  describe("openSession", () => {
    it("stores a session row with a hashed address and the user agent, and sets the signed httpOnly cookie for it", async () => {
      await testAuth.users.create({ id: "ana", email: "ana@example.org", name: "Ana", role: "EDITOR", active: true, createdAt: new Date(), lastLoginAt: null });

      const { sessionId } = await openSession({ kind: "user", userId: "ana" }, "EDITOR");

      const row = testAuth.sessions.sessions.get(sessionId);
      expect(row).toMatchObject({ kind: "user", userId: "ana", userAgent: "Mozilla/5.0 Test", revokedAt: null });
      expect(row?.ipHash).toMatch(/^[0-9a-f]{32}$/);
      expect(JSON.stringify(row)).not.toContain("203.0.113.5");

      const [, token, options] = sessionCookie();
      expect(options).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });
      expect(await verifySession(token)).toMatchObject({ valid: true, payload: { sid: sessionId, uid: "ana", role: "EDITOR", kind: "user" } });
    });

    it("opens a break-glass session with no user", async () => {
      const { sessionId } = await openSession({ kind: "break_glass" }, "ADMIN");

      expect(testAuth.sessions.sessions.get(sessionId)).toMatchObject({ kind: "break_glass", userId: null });
    });

    it("stores no address hash when the request carries no client address", async () => {
      headersGetMock.mockReturnValue(null);

      const { sessionId } = await openSession({ kind: "break_glass" }, "ADMIN");

      expect(testAuth.sessions.sessions.get(sessionId)).toMatchObject({ ipHash: null, userAgent: null });
    });

    it("rotates: the session the browser presented is revoked and the new one is a different id", async () => {
      const old = await openSession({ kind: "break_glass" }, "ADMIN");
      cookieGetMock.mockReturnValue({ name: AUTH_COOKIE_NAME, value: sessionCookie()[1] });

      const next = await openSession({ kind: "break_glass" }, "ADMIN");

      expect(next.sessionId).not.toBe(old.sessionId);
      expect(testAuth.sessions.sessions.get(old.sessionId)?.revokedAt).not.toBeNull();
      expect(testAuth.sessions.sessions.get(next.sessionId)?.revokedAt).toBeNull();
    });

    it("ignores a forged cookie instead of revoking whatever session it names", async () => {
      const other = await signInAs("EDITOR");
      const [otherSession] = [...testAuth.sessions.sessions.values()];
      cookieGetMock.mockReturnValue({ name: AUTH_COOKIE_NAME, value: `${other}x` });

      await openSession({ kind: "break_glass" }, "ADMIN");

      expect(testAuth.sessions.sessions.get(otherSession!.id)?.revokedAt).toBeNull();
    });
  });

  describe("openSession when the cookie cannot be issued", () => {
    const rows = () => [...testAuth.sessions.sessions.values()];

    it("revokes the session it just created when setting the cookie fails, and still throws", async () => {
      cookieSetMock.mockImplementationOnce(() => {
        throw new Error("cookie store unavailable");
      });

      await expect(openSession({ kind: "break_glass" }, "ADMIN")).rejects.toThrow("cookie store unavailable");

      expect(rows()).toHaveLength(1);
      expect(rows()[0]?.revokedAt).not.toBeNull();
    });

    it("leaves no live session when the signing secret is unusable", async () => {
      vi.stubEnv("ADMIN_SECRET", "short");

      await expect(openSession({ kind: "break_glass" }, "ADMIN")).rejects.toThrow();

      expect(rows().every((row) => row.revokedAt !== null)).toBe(true);
    });

    it("revokes a user's session the same way", async () => {
      await testAuth.users.create({ id: "ana", email: "ana@example.org", name: "Ana", role: "EDITOR", active: true, createdAt: new Date(), lastLoginAt: null });
      cookieSetMock.mockImplementationOnce(() => {
        throw new Error("boom");
      });

      await expect(openSession({ kind: "user", userId: "ana" }, "EDITOR")).rejects.toThrow("boom");

      expect(rows()[0]).toMatchObject({ userId: "ana" });
      expect(rows()[0]?.revokedAt).not.toBeNull();
    });

    it("keeps the original failure when revoking the orphan fails as well", async () => {
      vi.spyOn(testAuth.services.revokeSession, "execute").mockRejectedValue(new Error("database down"));
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      cookieSetMock.mockImplementationOnce(() => {
        throw new Error("cookie store unavailable");
      });

      await expect(openSession({ kind: "break_glass" }, "ADMIN")).rejects.toThrow("cookie store unavailable");

      expect(reportError).toHaveBeenCalledWith(expect.objectContaining({ message: "database down" }), { action: "login-orphan-session" });
    });
  });

  describe("closeSession", () => {
    it("revokes the session behind the cookie and clears the cookie", async () => {
      const token = await signInAs("EDITOR");
      const [session] = [...testAuth.sessions.sessions.values()];
      cookieGetMock.mockReturnValue({ name: AUTH_COOKIE_NAME, value: token });

      await closeSession();

      expect(testAuth.sessions.sessions.get(session!.id)?.revokedAt).not.toBeNull();
      expect(cookieSetMock).toHaveBeenCalledWith(AUTH_COOKIE_NAME, "", expect.objectContaining({ maxAge: 0 }));
    });

    it("clears the cookie, reports the error and leaks nothing when revoking the session fails", async () => {
      const token = await signInAs("EDITOR");
      cookieGetMock.mockReturnValue({ name: AUTH_COOKIE_NAME, value: token });
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
      const failure = new Error("connection refused: postgres://user:hunter2@db/prod");
      vi.spyOn(testAuth.services.revokeSession, "execute").mockRejectedValue(failure);

      await expect(closeSession()).resolves.toBeUndefined();

      expect(cookieSetMock).toHaveBeenCalledWith(AUTH_COOKIE_NAME, "", expect.objectContaining({ maxAge: 0 }));
      expect(reportError).toHaveBeenCalledWith(failure, { action: "logout-revoke" });
      expect(JSON.stringify(consoleError.mock.calls)).not.toContain("hunter2");
    });

    it("does not report a session that was already revoked", async () => {
      const token = await signInAs("EDITOR");
      const [session] = [...testAuth.sessions.sessions.values()];
      cookieGetMock.mockReturnValue({ name: AUTH_COOKIE_NAME, value: token });
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      await testAuth.sessions.revoke(session!.id, new Date());

      await closeSession();

      expect(reportError).not.toHaveBeenCalled();
      expect(cookieSetMock).toHaveBeenCalledWith(AUTH_COOKIE_NAME, "", expect.objectContaining({ maxAge: 0 }));
    });

    it("still clears the cookie when there is no valid session to revoke", async () => {
      cookieGetMock.mockReturnValue({ name: AUTH_COOKIE_NAME, value: "garbage" });

      await expect(closeSession()).resolves.toBeUndefined();

      expect(cookieSetMock).toHaveBeenCalledWith(AUTH_COOKIE_NAME, "", expect.objectContaining({ maxAge: 0 }));
    });
  });
});
