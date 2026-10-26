import { SignJWT } from "jose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { cookiesMock } = vi.hoisted(() => ({ cookiesMock: vi.fn() }));

vi.mock("next/headers", () => ({ cookies: cookiesMock }));

import { ForbiddenError } from "@/application";
import { AUTH_COOKIE_NAME, signSession } from "@/infrastructure/auth/session-jwt";
import { UnauthorizedError, requireRole, requireSession } from "@/interface/auth/require-session";
import { signInAs, testAuth } from "@/tests/support/test-auth";

const SECRET = "test-secret-test-secret-test-secret-1234";
const GOOGLE = { GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "secret", AUTH_URL: "https://admin.example.org" };

function withCookie(value: string | undefined): void {
  cookiesMock.mockResolvedValue({
    get: (name: string) => (name === AUTH_COOKIE_NAME && value !== undefined ? { name, value } : undefined),
  });
}

function signWith(secret: string, claims: Record<string, unknown> = {}, exp?: number): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  return new SignJWT({ sub: "test-editor", sid: "x", kind: "user", uid: "test-editor", role: "EDITOR", ...claims })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now - 100)
    .setExpirationTime(exp ?? now + 3600)
    .sign(new TextEncoder().encode(secret));
}

describe("requireSession", () => {
  beforeEach(() => {
    vi.stubEnv("ADMIN_SECRET", SECRET);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    cookiesMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("resolves the actor for a valid session of a registered user", async () => {
    withCookie(await signInAs("EDITOR"));

    await expect(requireSession()).resolves.toMatchObject({ kind: "user", userId: "test-editor", role: "EDITOR" });
  });

  it.each([
    ["no cookie", undefined],
    ["an empty cookie", ""],
    ["a malformed token", "not-a-jwt"],
  ])("rejects with %s", async (_label, value) => {
    withCookie(value);

    await expect(requireSession()).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("rejects a token signed with another secret and an expired token", async () => {
    withCookie(await signWith("another-secret-another-secret-1234567"));
    await expect(requireSession()).rejects.toBeInstanceOf(UnauthorizedError);

    withCookie(await signWith(SECRET, {}, Math.floor(Date.now() / 1000) - 3600));
    await expect(requireSession()).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("rejects a correctly signed token for a session that does not exist, and the legacy shared-password token", async () => {
    withCookie(await signWith(SECRET));
    await expect(requireSession()).rejects.toBeInstanceOf(UnauthorizedError);

    withCookie(await signWith(SECRET, { sub: "admin", sid: undefined, kind: undefined, uid: undefined, role: undefined }));
    await expect(requireSession()).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("rejects a revoked session", async () => {
    const token = await signInAs("EDITOR");
    withCookie(token);
    await requireSession();

    for (const session of testAuth.sessions.sessions.values()) await testAuth.sessions.revoke(session.id, new Date());

    await expect(requireSession()).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("rejects an expired session row, though the cookie itself has not expired", async () => {
    withCookie(await signInAs("EDITOR"));
    for (const [id, session] of testAuth.sessions.sessions) testAuth.sessions.sessions.set(id, { ...session, expiresAt: new Date(Date.now() - 1000) });

    await expect(requireSession()).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("rejects the session of a user who was deactivated, and takes a demotion into account at once", async () => {
    withCookie(await signInAs("ADMIN"));
    await expect(requireSession()).resolves.toMatchObject({ role: "ADMIN" });

    testAuth.users.users.set("test-admin", { ...testAuth.users.users.get("test-admin")!, role: "EDITOR" });
    await expect(requireSession()).resolves.toMatchObject({ role: "EDITOR" });

    testAuth.users.users.set("test-admin", { ...testAuth.users.users.get("test-admin")!, active: false });
    await expect(requireSession()).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("does not trust the role claim in the cookie: a token claiming ADMIN for an editor's session is an editor", async () => {
    await signInAs("EDITOR");
    const [session] = [...testAuth.sessions.sessions.values()];
    withCookie(await signSession({ sid: session!.id, kind: "user", uid: "test-editor", role: "ADMIN" }));

    await expect(requireSession()).resolves.toMatchObject({ role: "EDITOR" });
  });

  it("rejects a token whose kind differs from the session's", async () => {
    await signInAs("EDITOR");
    const [session] = [...testAuth.sessions.sessions.values()];
    withCookie(await signSession({ sid: session!.id, kind: "break_glass", uid: null, role: "ADMIN" }));

    await expect(requireSession()).rejects.toBeInstanceOf(UnauthorizedError);
  });

  describe("break-glass", () => {
    it("resolves a synthetic admin while the emergency login is enabled", async () => {
      withCookie(await signInAs("break_glass"));

      await expect(requireSession()).resolves.toMatchObject({ kind: "break_glass", userId: null, role: "ADMIN" });
    });

    it("is rejected once its session was revoked", async () => {
      withCookie(await signInAs("break_glass"));
      for (const session of testAuth.sessions.sessions.values()) await testAuth.sessions.revoke(session.id, new Date());

      await expect(requireSession()).rejects.toBeInstanceOf(UnauthorizedError);
    });

    it("is rejected, though the row is still active, once Google is configured and the flag is off", async () => {
      withCookie(await signInAs("break_glass"));
      await expect(requireSession()).resolves.toBeDefined();

      for (const [name, value] of Object.entries(GOOGLE)) vi.stubEnv(name, value);
      await expect(requireSession()).rejects.toBeInstanceOf(UnauthorizedError);

      vi.stubEnv("BREAK_GLASS_PASSWORD_LOGIN", "1");
      await expect(requireSession()).resolves.toBeDefined();
    });
  });

  it("fails closed when the signing secret is missing or too short", async () => {
    withCookie(await signInAs("EDITOR"));

    vi.stubEnv("ADMIN_SECRET", "");
    await expect(requireSession()).rejects.toBeInstanceOf(UnauthorizedError);

    vi.stubEnv("ADMIN_SECRET", "short");
    await expect(requireSession()).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("fails closed when the cookie store itself throws, and when the database does", async () => {
    cookiesMock.mockRejectedValue(new Error("no request scope"));
    await expect(requireSession()).rejects.toBeInstanceOf(UnauthorizedError);

    withCookie(await signInAs("EDITOR"));
    vi.spyOn(testAuth.sessions, "findWithUser").mockRejectedValue(new Error("db down"));
    await expect(requireSession()).rejects.toBeInstanceOf(UnauthorizedError);
  });
});

describe("requireRole", () => {
  beforeEach(() => {
    vi.stubEnv("ADMIN_SECRET", SECRET);
    cookiesMock.mockReset();
  });

  afterEach(() => vi.unstubAllEnvs());

  it.each([
    ["ADMIN", "ADMIN", true],
    ["ADMIN", "EDITOR", true],
    ["EDITOR", "EDITOR", true],
    ["EDITOR", "ADMIN", false],
    ["break_glass", "ADMIN", true],
  ] as const)("a %s session asked for %s: allowed=%s", async (who, required, allowed) => {
    withCookie(await signInAs(who));

    if (allowed) {
      await expect(requireRole(required)).resolves.toBeDefined();
    } else {
      await expect(requireRole(required)).rejects.toBeInstanceOf(ForbiddenError);
    }
  });

  it("is unauthorized, not forbidden, without a session", async () => {
    withCookie(undefined);

    await expect(requireRole("EDITOR")).rejects.toBeInstanceOf(UnauthorizedError);
  });
});
