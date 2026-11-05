import { SignJWT } from "jose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { cookiesMock } = vi.hoisted(() => ({ cookiesMock: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: cookiesMock }));

import { ForbiddenError } from "@/application";
import { AUTH_COOKIE_NAME } from "@/infrastructure/auth/session-jwt";
import { FORUM_COOKIE_NAME } from "@/infrastructure/forum/forum-session-jwt";
import { UnauthorizedError, requireRole, requireSession } from "@/interface/auth/require-session";
import { ForumUnauthorizedError, getForumMember, requireForumMember } from "@/interface/forum/require-forum-member";
import { signInAs } from "@/tests/support/test-auth";
import { signInToForumAs, testForum } from "@/tests/support/test-forum";

const ADMIN_SECRET = "admin-secret-admin-secret-admin-secret-1234";
const FORUM_SECRET = "forum-secret-forum-secret-forum-secret-1234";

/** A browser jar: each cookie by name; only what a request would carry. */
function jar(cookies: Record<string, string | undefined>): void {
  cookiesMock.mockResolvedValue({
    get: (name: string) => (cookies[name] === undefined ? undefined : { name, value: cookies[name] }),
  });
}

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

describe("requireForumMember", () => {
  it("returns the member behind a valid forum session: ids and public name only", async () => {
    const { cookie, memberId, sessionId } = await signInToForumAs({ displayName: "Ana" });
    jar({ [FORUM_COOKIE_NAME]: cookie });

    expect(await requireForumMember()).toEqual({ memberId, sessionId, displayName: "Ana" });
  });

  it.each([
    ["no cookie", undefined],
    ["a malformed cookie", "not-a-jwt"],
  ])("refuses %s", async (_label, cookie) => {
    jar({ [FORUM_COOKIE_NAME]: cookie });

    await expect(requireForumMember()).rejects.toThrow(ForumUnauthorizedError);
    expect(await getForumMember()).toBeNull();
  });

  it("refuses a cookie signed with another secret and an expired one", async () => {
    const forged = await new SignJWT({ sid: "s", mid: "m", typ: "forum-session", aud: "aso-computacion-forum" })
      .setSubject("m")
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode("x".repeat(40)));
    const { cookie } = await signInToForumAs();

    jar({ [FORUM_COOKIE_NAME]: forged });
    await expect(requireForumMember()).rejects.toThrow(ForumUnauthorizedError);

    vi.useFakeTimers({ now: Date.now() + 8 * 24 * 60 * 60 * 1000 });
    jar({ [FORUM_COOKIE_NAME]: cookie });
    await expect(requireForumMember()).rejects.toThrow(ForumUnauthorizedError);
    vi.useRealTimers();
  });

  it("refuses a revoked session, and a suspended member on the very next request", async () => {
    const revoked = await signInToForumAs({ id: "m1", email: "a@unl.edu.ec", googleSub: "s1" });
    const suspended = await signInToForumAs({ id: "m2", email: "b@unl.edu.ec", googleSub: "s2" });
    await testForum.services.closeSession.execute({ sessionId: revoked.sessionId });
    testForum.members.members.set("m2", { ...testForum.members.members.get("m2")!, status: "SUSPENDED", suspendedAt: new Date() });

    jar({ [FORUM_COOKIE_NAME]: revoked.cookie });
    await expect(requireForumMember()).rejects.toThrow(ForumUnauthorizedError);
    jar({ [FORUM_COOKIE_NAME]: suspended.cookie });
    await expect(requireForumMember()).rejects.toThrow(ForumUnauthorizedError);
  });

  it("fails closed when the forum secret is missing, short or the admin's: even a once-valid cookie is refused", async () => {
    const { cookie } = await signInToForumAs();
    jar({ [FORUM_COOKIE_NAME]: cookie });

    for (const secret of ["", "short", ADMIN_SECRET]) {
      vi.stubEnv("FORUM_SESSION_SECRET", secret);

      await expect(requireForumMember()).rejects.toThrow(ForumUnauthorizedError);
    }
  });

  it("fails closed on a database error", async () => {
    const { cookie } = await signInToForumAs();
    jar({ [FORUM_COOKIE_NAME]: cookie });
    vi.spyOn(testForum.sessions, "findWithMember").mockRejectedValue(new Error("db down"));

    await expect(requireForumMember()).rejects.toThrow(ForumUnauthorizedError);
  });

  it("lets Next's own signals (redirects, not-found, dynamic rendering) through", async () => {
    cookiesMock.mockRejectedValue(Object.assign(new Error("bail"), { digest: "DYNAMIC_SERVER_USAGE" }));

    await expect(requireForumMember()).rejects.toMatchObject({ digest: "DYNAMIC_SERVER_USAGE" });
  });
});

describe("an admin session is not a forum member", () => {
  it("is refused when it is the only cookie the browser sends to /foro", async () => {
    jar({ [AUTH_COOKIE_NAME]: await signInAs("ADMIN") });

    await expect(requireForumMember()).rejects.toThrow(ForumUnauthorizedError);
  });

  it("is refused even when planted in the forum cookie, and so is a break-glass session", async () => {
    for (const who of ["ADMIN", "EDITOR", "break_glass"] as const) {
      jar({ [FORUM_COOKIE_NAME]: await signInAs(who) });

      await expect(requireForumMember()).rejects.toThrow(ForumUnauthorizedError);
    }
  });

  it("does not turn a forum member into an admin when both cookies are present: the forum guard looks only at its own", async () => {
    const { cookie, memberId } = await signInToForumAs();
    jar({ [AUTH_COOKIE_NAME]: await signInAs("ADMIN"), [FORUM_COOKIE_NAME]: cookie });

    expect((await requireForumMember()).memberId).toBe(memberId);
  });
});

describe("a forum session is not an admin session", () => {
  it("is refused by the admin guards when it is the only cookie", async () => {
    const { cookie } = await signInToForumAs();
    jar({ [FORUM_COOKIE_NAME]: cookie });

    await expect(requireSession()).rejects.toThrow(UnauthorizedError);
    await expect(requireRole("ADMIN")).rejects.toThrow(UnauthorizedError);
    await expect(requireRole("EDITOR")).rejects.toThrow(UnauthorizedError);
  });

  it("is refused by the admin guards even when planted in the admin cookie", async () => {
    const { cookie } = await signInToForumAs();
    jar({ [AUTH_COOKIE_NAME]: cookie });

    await expect(requireSession()).rejects.toThrow(UnauthorizedError);
    await expect(requireRole("ADMIN")).rejects.toThrow(UnauthorizedError);
  });

  it("is refused even if the forum secret were set to the admin's (claims alone keep them apart)", async () => {
    const sameSecretToken = await new SignJWT({ sid: "s", mid: "member-1", typ: "forum-session" })
      .setSubject("member-1")
      .setAudience("aso-computacion-forum")
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode(ADMIN_SECRET));
    jar({ [AUTH_COOKIE_NAME]: sameSecretToken });

    await expect(requireSession()).rejects.toThrow(UnauthorizedError);
  });

  it("still lets a real admin through, and keeps the editor/admin split (regression for the admin guard)", async () => {
    jar({ [AUTH_COOKIE_NAME]: await signInAs("EDITOR") });

    expect((await requireSession()).role).toBe("EDITOR");
    await expect(requireRole("ADMIN")).rejects.toThrow(ForbiddenError);

    jar({ [AUTH_COOKIE_NAME]: await signInAs("ADMIN") });
    expect((await requireRole("ADMIN")).role).toBe("ADMIN");
  });
});

describe("the admin middleware", () => {
  it("sends a request that carries only a forum cookie to the login", async () => {
    vi.stubEnv("ADMIN_SECRET", ADMIN_SECRET);
    const { proxy } = await import("../../../../../proxy");
    const { NextRequest } = await import("next/server");
    const { cookie } = await signInToForumAs();
    const request = new NextRequest(new URL("/admin/events", "http://localhost:3000"), { headers: { cookie: `${FORUM_COOKIE_NAME}=${cookie}` } });

    const response = await proxy(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/login");
  });
});
