import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookieSetMock, cookieGetMock, cookieDeleteMock, reportErrorMock } = vi.hoisted(() => ({
  cookieSetMock: vi.fn(),
  cookieGetMock: vi.fn(),
  cookieDeleteMock: vi.fn(),
  reportErrorMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ set: cookieSetMock, get: cookieGetMock, delete: cookieDeleteMock })),
  headers: vi.fn(async () => new Headers({ "user-agent": "Test Browser", "x-forwarded-for": "203.0.113.5" })),
}));
vi.mock("@/infrastructure/observability/report-error", () => ({ reportError: reportErrorMock }));

import { NotFoundError } from "@/application/use-cases/use-case-error";
import { FORUM_COOKIE_NAME, verifyForumSession } from "@/infrastructure/forum/forum-session-jwt";
import { closeForumSession, openForumSession } from "@/interface/forum/forum-session-lifecycle";
import { makeForumMember } from "@/tests/fakes/in-memory-forum";
import { signInToForumAs, testForum } from "@/tests/support/test-forum";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("ADMIN_SECRET", "admin-secret-admin-secret-admin-secret-1234");
  vi.stubEnv("FORUM_SESSION_SECRET", "forum-secret-forum-secret-forum-secret-1234");
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  cookieGetMock.mockReturnValue(undefined);
  testForum.members.members.set("member-1", makeForumMember());
});

describe("openForumSession", () => {
  it("stores the session with a hashed address and the user agent, and sets a /foro cookie that names it", async () => {
    const { sessionId } = await openForumSession("member-1");

    expect(testForum.sessions.sessions.get(sessionId)).toMatchObject({ memberId: "member-1", userAgent: "Test Browser", revokedAt: null });
    expect(testForum.sessions.sessions.get(sessionId)?.ipHash).toMatch(/^[0-9a-f]{32}$/);
    expect(JSON.stringify([...testForum.sessions.sessions.values()])).not.toContain("203.0.113.5");

    const [name, token, options] = cookieSetMock.mock.calls[0] as [string, string, Record<string, unknown>];
    expect(name).toBe(FORUM_COOKIE_NAME);
    expect(options).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/foro" });
    expect(await verifyForumSession(token)).toEqual({ valid: true, payload: { sid: sessionId, memberId: "member-1" } });
  });

  it("revokes the session the browser already presented, so a login never keeps an old one alive", async () => {
    const old = await signInToForumAs({ id: "member-1" });
    cookieGetMock.mockImplementation((name: string) => (name === FORUM_COOKIE_NAME ? { name, value: old.cookie } : undefined));

    const { sessionId } = await openForumSession("member-1");

    expect(testForum.sessions.sessions.get(old.sessionId)?.revokedAt).not.toBeNull();
    expect(testForum.sessions.sessions.get(sessionId)?.revokedAt).toBeNull();
  });

  it("leaves no live orphan row when the cookie cannot be issued", async () => {
    cookieSetMock.mockImplementationOnce(() => {
      throw new Error("cannot set cookie");
    });

    await expect(openForumSession("member-1")).rejects.toThrow("cannot set cookie");

    const rows = [...testForum.sessions.sessions.values()];

    expect(rows).toHaveLength(1);
    expect(rows.every((session) => session.revokedAt !== null)).toBe(true);
  });

  it("opens nothing without a usable forum secret", async () => {
    vi.stubEnv("FORUM_SESSION_SECRET", "short");

    await expect(openForumSession("member-1")).rejects.toThrow();
    expect(cookieSetMock).not.toHaveBeenCalled();
  });
});

describe("closeForumSession", () => {
  it("revokes this browser's session and clears the /foro cookie", async () => {
    const { cookie, sessionId } = await signInToForumAs({ id: "member-1" });
    cookieGetMock.mockImplementation((name: string) => (name === FORUM_COOKIE_NAME ? { name, value: cookie } : undefined));

    await closeForumSession();

    expect(testForum.sessions.sessions.get(sessionId)?.revokedAt).not.toBeNull();
    expect(cookieSetMock).toHaveBeenCalledWith(FORUM_COOKIE_NAME, "", expect.objectContaining({ path: "/foro", maxAge: 0 }));
  });

  it("still revokes the session when the guard would refuse it: the member was suspended since", async () => {
    const { cookie, sessionId } = await signInToForumAs({ id: "member-1" });
    testForum.members.members.set("member-1", makeForumMember({ status: "SUSPENDED", suspendedAt: new Date() }));
    cookieGetMock.mockImplementation((name: string) => (name === FORUM_COOKIE_NAME ? { name, value: cookie } : undefined));

    await closeForumSession();

    expect(testForum.sessions.sessions.get(sessionId)?.revokedAt).not.toBeNull();
    expect(cookieSetMock).toHaveBeenCalledWith(FORUM_COOKIE_NAME, "", expect.objectContaining({ maxAge: 0 }));
    expect(reportErrorMock).not.toHaveBeenCalled();
  });

  it("clears the cookie and revokes nothing for a cookie that is not a signed forum token", async () => {
    const { sessionId } = await signInToForumAs({ id: "member-1" });
    cookieGetMock.mockImplementation((name: string) => (name === FORUM_COOKIE_NAME ? { name, value: `forged.${sessionId}.token` } : undefined));

    await closeForumSession();

    expect(testForum.sessions.sessions.get(sessionId)?.revokedAt).toBeNull();
    expect(cookieSetMock).toHaveBeenCalledWith(FORUM_COOKIE_NAME, "", expect.objectContaining({ maxAge: 0 }));
  });

  it("reports a revoke that fails, and still clears the cookie", async () => {
    const { cookie } = await signInToForumAs({ id: "member-1" });
    cookieGetMock.mockImplementation((name: string) => (name === FORUM_COOKIE_NAME ? { name, value: cookie } : undefined));
    vi.spyOn(testForum.sessions, "revoke").mockRejectedValueOnce(new Error("db down"));

    await closeForumSession();

    expect(reportErrorMock).toHaveBeenCalledWith(expect.any(Error), { action: "forum-logout-revoke" });
    expect(cookieSetMock).toHaveBeenCalledWith(FORUM_COOKIE_NAME, "", expect.objectContaining({ maxAge: 0 }));
  });

  it("treats a session that is already gone or already revoked as a normal logout, not an error", async () => {
    const { cookie, sessionId } = await signInToForumAs({ id: "member-1" });
    cookieGetMock.mockImplementation((name: string) => (name === FORUM_COOKIE_NAME ? { name, value: cookie } : undefined));

    await testForum.sessions.revoke(sessionId, new Date());
    await closeForumSession();

    testForum.sessions.sessions.delete(sessionId);
    await closeForumSession();

    vi.spyOn(testForum.sessions, "revoke").mockRejectedValueOnce(new NotFoundError("Forum session not found"));
    await closeForumSession();

    expect(reportErrorMock).not.toHaveBeenCalled();
    expect(cookieSetMock).toHaveBeenCalledTimes(3);
    expect(cookieSetMock).toHaveBeenLastCalledWith(FORUM_COOKIE_NAME, "", expect.objectContaining({ maxAge: 0 }));
  });

  it("clears the cookie even when there was no valid session, without reporting an error", async () => {
    await closeForumSession();

    expect(cookieSetMock).toHaveBeenCalledWith(FORUM_COOKIE_NAME, "", expect.objectContaining({ maxAge: 0 }));
    expect(reportErrorMock).not.toHaveBeenCalled();
  });
});
