import { SignJWT } from "jose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { cookiesMock } = vi.hoisted(() => ({ cookiesMock: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: cookiesMock }));

import { AUTH_COOKIE_NAME } from "@/infrastructure/auth/session-jwt";
import { FORUM_COOKIE_NAME } from "@/infrastructure/forum/forum-session-jwt";
import { hasSuspendedForumSession } from "@/interface/forum/forum-suspension";
import { ForumUnauthorizedError, requireForumMember } from "@/interface/forum/require-forum-member";
import { signInAs } from "@/tests/support/test-auth";
import { signInToForumAs, testForum } from "@/tests/support/test-forum";

const ADMIN_SECRET = "admin-secret-admin-secret-admin-secret-1234";
const FORUM_SECRET = "forum-secret-forum-secret-forum-secret-1234";

function jar(cookies: Record<string, string | undefined>): void {
  cookiesMock.mockResolvedValue({ get: (name: string) => (cookies[name] === undefined ? undefined : { name, value: cookies[name] }) });
}

const suspend = (id: string) => testForum.members.members.set(id, { ...testForum.members.members.get(id)!, status: "SUSPENDED", suspendedAt: new Date() });

beforeEach(() => {
  vi.stubEnv("ADMIN_SECRET", ADMIN_SECRET);
  vi.stubEnv("FORUM_SESSION_SECRET", FORUM_SECRET);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  cookiesMock.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("hasSuspendedForumSession (D1): only the holder of the member's own signed cookie learns of the suspension", () => {
  it("is true for the signed cookie of a member the moderation suspended, with the session open or already closed by the suspension", async () => {
    const { cookie, memberId, sessionId } = await signInToForumAs();
    suspend(memberId);
    jar({ [FORUM_COOKIE_NAME]: cookie });

    expect(await hasSuspendedForumSession()).toBe(true);

    await testForum.services.closeSession.execute({ sessionId });
    expect(await hasSuspendedForumSession()).toBe(true);
  });

  it("never lets that member in: the guard still refuses the very same cookie", async () => {
    const { cookie, memberId } = await signInToForumAs();
    suspend(memberId);
    jar({ [FORUM_COOKIE_NAME]: cookie });

    expect(await hasSuspendedForumSession()).toBe(true);
    await expect(requireForumMember()).rejects.toThrow(ForumUnauthorizedError);
  });

  it("is false for an active member: the notice is not a way to probe accounts", async () => {
    const { cookie } = await signInToForumAs();
    jar({ [FORUM_COOKIE_NAME]: cookie });

    expect(await hasSuspendedForumSession()).toBe(false);
  });

  it.each([
    ["no cookie", undefined],
    ["a malformed cookie", "not-a-jwt"],
  ])("is false with %s", async (_label, cookie) => {
    jar({ [FORUM_COOKIE_NAME]: cookie });

    expect(await hasSuspendedForumSession()).toBe(false);
  });

  it("is false for a cookie someone made up with a suspended member's ids, signed with another secret", async () => {
    const { memberId, sessionId } = await signInToForumAs();
    suspend(memberId);
    const forged = await new SignJWT({ sid: sessionId, mid: memberId, typ: "forum-session" })
      .setSubject(memberId)
      .setAudience("aso-computacion-forum")
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode("x".repeat(40)));
    jar({ [FORUM_COOKIE_NAME]: forged });

    expect(await hasSuspendedForumSession()).toBe(false);
  });

  it("is false once the cookie itself has expired, and for an admin session planted in the forum cookie or sent as its own", async () => {
    const { cookie, memberId } = await signInToForumAs();
    suspend(memberId);

    vi.useFakeTimers({ now: Date.now() + 8 * 24 * 60 * 60 * 1000 });
    jar({ [FORUM_COOKIE_NAME]: cookie });
    expect(await hasSuspendedForumSession()).toBe(false);
    vi.useRealTimers();

    const admin = await signInAs("ADMIN");
    jar({ [FORUM_COOKIE_NAME]: admin });
    expect(await hasSuspendedForumSession()).toBe(false);
    jar({ [AUTH_COOKIE_NAME]: admin });
    expect(await hasSuspendedForumSession()).toBe(false);
  });

  it("is false, never an error, when the forum secret is missing or the database fails: the page then shows the plain sign-in", async () => {
    const { cookie, memberId } = await signInToForumAs();
    suspend(memberId);
    jar({ [FORUM_COOKIE_NAME]: cookie });

    vi.stubEnv("FORUM_SESSION_SECRET", "short");
    expect(await hasSuspendedForumSession()).toBe(false);

    vi.stubEnv("FORUM_SESSION_SECRET", FORUM_SECRET);
    vi.spyOn(testForum.sessions, "findWithMember").mockRejectedValue(new Error("db down"));
    expect(await hasSuspendedForumSession()).toBe(false);
  });

  it("lets Next's own signals through", async () => {
    cookiesMock.mockRejectedValue(Object.assign(new Error("bail"), { digest: "DYNAMIC_SERVER_USAGE" }));

    await expect(hasSuspendedForumSession()).rejects.toMatchObject({ digest: "DYNAMIC_SERVER_USAGE" });
  });
});
