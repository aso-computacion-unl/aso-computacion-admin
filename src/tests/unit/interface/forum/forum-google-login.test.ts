import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookieSetMock, cookieDeleteMock, cookieGetMock, completeMock, startMock, reportErrorMock, adminOpenSessionMock, consumeMock, recordSuccessMock, throttleTargetMock } = vi.hoisted(() => ({
  cookieSetMock: vi.fn(),
  cookieDeleteMock: vi.fn(),
  cookieGetMock: vi.fn(),
  completeMock: vi.fn(),
  startMock: vi.fn(),
  reportErrorMock: vi.fn(),
  adminOpenSessionMock: vi.fn(),
  consumeMock: vi.fn(),
  recordSuccessMock: vi.fn(),
  throttleTargetMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ set: cookieSetMock, delete: cookieDeleteMock, get: cookieGetMock })),
  headers: vi.fn(async () => new Headers({ "user-agent": "UA", "x-forwarded-for": "203.0.113.5" })),
}));
vi.mock("@/interface/auth/session-lifecycle", () => ({ openSession: adminOpenSessionMock }));
vi.mock("@/interface/auth/login-throttle", () => ({ resolveThrottleTarget: throttleTargetMock }));
vi.mock("@/infrastructure/auth/login-rate-limiter", () => ({ consumeLoginAttempt: consumeMock, recordSuccessfulLogin: recordSuccessMock }));
vi.mock("@/infrastructure/observability/report-error", () => ({ reportError: reportErrorMock }));
vi.mock("@/infrastructure/auth/google-oauth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/infrastructure/auth/google-oauth")>()),
  completeGoogleAuthorization: completeMock,
  startGoogleAuthorization: startMock,
  googleClient: () => ({ validateAuthorizationCode: vi.fn() }),
}));

import { GoogleAuthError } from "@/infrastructure/auth/google-oauth";
import { OAUTH_STATE_COOKIE_NAME, sealOAuthState } from "@/infrastructure/auth/oauth-state";
import { FORUM_OAUTH_STATE_COOKIE_NAME, openForumOAuthState, sealForumOAuthState } from "@/infrastructure/forum/forum-oauth-state";
import { FORUM_COOKIE_NAME, verifyForumSession } from "@/infrastructure/forum/forum-session-jwt";
import { finishForumLogin, startForumLogin } from "@/interface/forum/forum-google-login";
import { finishGoogleLogin, startGoogleLogin } from "@/interface/auth/google-login";
import { makeForumMember } from "@/tests/fakes/in-memory-forum";
import { makeUser } from "@/tests/fakes/in-memory-auth";
import { testAuth } from "@/tests/support/test-auth";
import { testForum } from "@/tests/support/test-forum";

const ENV = {
  GOOGLE_CLIENT_ID: "client-id",
  GOOGLE_CLIENT_SECRET: "client-secret",
  AUTH_URL: "https://admin.example.org",
  ADMIN_SECRET: "admin-secret-admin-secret-admin-secret-1234",
  FORUM_SESSION_SECRET: "forum-secret-forum-secret-forum-secret-1234",
  FORUM_ALLOWED_EMAIL_DOMAIN: "unl.edu.ec",
};
const FLOW = { state: "the-state", codeVerifier: "the-verifier", nonce: "the-nonce" };
const IDENTITY = { email: "ana@unl.edu.ec", emailVerified: true, subject: "sub-ana", name: "Ana Pérez", hostedDomain: "unl.edu.ec" };

const request = (query: string) => new Request(`https://admin.example.org/foro/auth/google/callback${query}`);
const location = (response: Response) => response.headers.get("location");
const cookiesSet = () => cookieSetMock.mock.calls.map(([name]) => name as string);

let sealedFlow = "";
let sealedAdminFlow = "";

beforeEach(async () => {
  vi.clearAllMocks();
  for (const [name, value] of Object.entries(ENV)) vi.stubEnv(name, value);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  sealedFlow = await sealForumOAuthState(FLOW);
  sealedAdminFlow = await sealOAuthState(FLOW);
  cookieGetMock.mockImplementation((name: string) => (name === FORUM_OAUTH_STATE_COOKIE_NAME ? { name, value: sealedFlow } : undefined));
  completeMock.mockResolvedValue(IDENTITY);
});

describe("startForumLogin", () => {
  it("redirects to Google with the forum redirect URI, keeping the flow in a sealed httpOnly cookie for the forum routes only", async () => {
    startMock.mockReturnValue({ url: new URL("https://accounts.google.com/o/oauth2/v2/auth?state=the-state"), ...FLOW });

    const response = await startForumLogin(new Request("https://admin.example.org/foro/auth/google/start"));

    expect(location(response)).toBe("https://accounts.google.com/o/oauth2/v2/auth?state=the-state");
    expect(startMock).toHaveBeenCalledWith({ clientId: "client-id", clientSecret: "client-secret", redirectUri: "https://admin.example.org/foro/auth/google/callback" });

    const [name, value, options] = cookieSetMock.mock.calls[0] as [string, string, Record<string, unknown>];
    expect(name).toBe(FORUM_OAUTH_STATE_COOKIE_NAME);
    expect(name).not.toBe(OAUTH_STATE_COOKIE_NAME);
    expect(value).not.toContain("the-verifier");
    expect(options).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/foro/auth/google", maxAge: 600 });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  describe("the return path (?next=)", () => {
    const startWith = async (query: string) => {
      startMock.mockReturnValue({ url: new URL("https://accounts.google.com/o/oauth2/v2/auth?state=the-state"), ...FLOW });

      const response = await startForumLogin(new Request(`https://admin.example.org/foro/auth/google/start${query}`));
      const sealed = cookieSetMock.mock.calls[0]?.[1] as string;

      return { response, flow: await openForumOAuthState(sealed) };
    };

    it("seals a valid forum path into the state cookie, next to the flow's own secrets", async () => {
      const { response, flow } = await startWith(`?next=${encodeURIComponent("/foro/hilo/abc?x=1")}`);

      expect(location(response)).toBe("https://accounts.google.com/o/oauth2/v2/auth?state=the-state");
      expect(flow).toEqual({ ...FLOW, next: "/foro/hilo/abc?x=1" });
    });

    it("seals the event registration page, which lives outside the forum", async () => {
      const { flow } = await startWith(`?next=${encodeURIComponent("/inscripciones/taller-git")}`);

      expect(flow).toEqual({ ...FLOW, next: "/inscripciones/taller-git" });
    });

    it("seals the normalized path, not the raw one", async () => {
      expect((await startWith(`?next=${encodeURIComponent("/foro/c/./programacion#top")}`)).flow?.next).toBe("/foro/c/programacion");
    });

    it("seals nothing without a next", async () => {
      expect((await startWith("")).flow).toEqual(FLOW);
    });

    it.each([
      ["an external URL", "https://evil.example/foro/hilo/1"],
      ["a protocol-relative URL", "//evil.example"],
      ["a backslash", "/foro\\evil.example"],
      ["an encoded trick", "/foro/%2f%2fevil.example"],
      ["a path outside the forum", "/admin"],
      ["the forum's auth routes", "/foro/auth/google/start"],
      ["a path that is too long", `/foro/${"a".repeat(600)}`],
    ])("ignores %s: Google still starts, nothing is sealed, no error page", async (_label, next) => {
      const { response, flow } = await startWith(`?next=${encodeURIComponent(next)}`);

      expect(location(response)).toBe("https://accounts.google.com/o/oauth2/v2/auth?state=the-state");
      expect(flow).toEqual(FLOW);
    });

    it("does not pass next to Google", async () => {
      await startWith(`?next=${encodeURIComponent("/foro/hilo/abc")}`);

      expect(startMock).toHaveBeenCalledWith({ clientId: "client-id", clientSecret: "client-secret", redirectUri: "https://admin.example.org/foro/auth/google/callback" });
    });
  });

  it.each(["FORUM_ALLOWED_EMAIL_DOMAIN", "FORUM_SESSION_SECRET", "GOOGLE_CLIENT_ID", "AUTH_URL"])("fails closed without %s: back to the forum page, nothing set, Google never called", async (name) => {
    vi.stubEnv(name, "");

    const response = await startForumLogin(new Request("https://admin.example.org/foro/auth/google/start"));

    expect(location(response)).toBe("https://admin.example.org/foro?error=unavailable");
    expect(cookieSetMock).not.toHaveBeenCalled();
    expect(startMock).not.toHaveBeenCalled();
  });
});

describe("D5/D8: a sign-in that starts from an event's registration page", () => {
  it("fails closed back to that page, not to the forum, so no registration screen speaks of the forum", async () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "");

    const response = await startForumLogin(new Request(`https://admin.example.org/foro/auth/google/start?next=${encodeURIComponent("/inscripciones/taller-git")}`));

    expect(location(response)).toBe("https://admin.example.org/inscripciones/taller-git?error=unavailable");
    expect(cookieSetMock).not.toHaveBeenCalled();
  });

  it("fails closed to the forum landing when the return path is a forum one or invalid", async () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "");

    for (const next of ["/foro/hilo/abc", "/inscripciones/", "https://evil.example/inscripciones/x"]) {
      const response = await startForumLogin(new Request(`https://admin.example.org/foro/auth/google/start?next=${encodeURIComponent(next)}`));

      expect(location(response), next).toBe("https://admin.example.org/foro?error=unavailable");
    }
  });

  it("sends a Google start that blows up back to the registration page too", async () => {
    startMock.mockImplementation(() => {
      throw new Error("boom");
    });

    const response = await startForumLogin(new Request(`https://admin.example.org/foro/auth/google/start?next=${encodeURIComponent("/inscripciones/taller-git?utm=1")}`));

    expect(location(response)).toBe("https://admin.example.org/inscripciones/taller-git?utm=1&error=unavailable");
  });
});

describe("finishForumLogin", () => {
  it("signs a new student in: creates the member, opens a session, sets the site-wide cookie and goes to the forum", async () => {
    const response = await finishForumLogin(request("?code=auth-code&state=the-state"));

    expect(location(response)).toBe("https://admin.example.org/foro");
    expect(completeMock).toHaveBeenCalledWith(expect.objectContaining({ code: "auth-code", codeVerifier: "the-verifier", nonce: "the-nonce", clientId: "client-id" }));
    expect([...testForum.members.members.values()]).toMatchObject([{ email: "ana@unl.edu.ec", googleSub: "sub-ana", displayName: "Ana Pérez", status: "ACTIVE" }]);
    expect(testForum.sessions.sessions.size).toBe(1);

    const [name, token, options] = cookieSetMock.mock.calls.find(([cookie]) => cookie === FORUM_COOKIE_NAME) as [string, string, Record<string, unknown>];
    expect(options).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/", maxAge: 7 * 24 * 60 * 60 });
    expect(await verifyForumSession(token)).toMatchObject({ valid: true });
    expect(name).toBe("forum_sid");
  });

  it("recognises a returning student by Google sub and creates nothing new", async () => {
    await finishForumLogin(request("?code=c&state=the-state"));
    await finishForumLogin(request("?code=c&state=the-state"));

    expect(testForum.members.members.size).toBe(1);
    expect(testForum.sessions.sessions.size).toBe(2);
  });

  it("always clears the flow cookie, so a callback URL cannot be replayed", async () => {
    await finishForumLogin(request("?code=c&state=the-state"));
    await finishForumLogin(request("?code=c&state=wrong"));

    expect(cookieDeleteMock).toHaveBeenCalledTimes(2);
    expect(cookieDeleteMock).toHaveBeenCalledWith({ name: FORUM_OAUTH_STATE_COOKIE_NAME, path: "/foro/auth/google" });
  });

  describe("the return path", () => {
    const sealWith = async (next: string) => {
      sealedFlow = await sealForumOAuthState({ ...FLOW, next });
    };

    it("goes to the path sealed at the start once the login succeeds", async () => {
      await sealWith("/foro/hilo/abc?x=1");

      const response = await finishForumLogin(request("?code=c&state=the-state"));

      expect(location(response)).toBe("https://admin.example.org/foro/hilo/abc?x=1");
      expect(testForum.sessions.sessions.size).toBe(1);
      expect(response.headers.get("cache-control")).toBe("no-store");
    });

    it("brings the student back to the event registration page, outside the forum, with the session set", async () => {
      await sealWith("/inscripciones/taller-git");

      const response = await finishForumLogin(request("?code=c&state=the-state"));

      expect(location(response)).toBe("https://admin.example.org/inscripciones/taller-git");
      expect(cookieSetMock).toHaveBeenCalledWith(FORUM_COOKIE_NAME, expect.any(String), expect.objectContaining({ path: "/" }));
    });

    it("ignores a next in the callback URL: without a sealed one it goes to /foro", async () => {
      const response = await finishForumLogin(request(`?code=c&state=the-state&next=${encodeURIComponent("/foro/hilo/evil")}`));

      expect(location(response)).toBe("https://admin.example.org/foro");
    });

    it("prefers the sealed path over the one in the callback URL", async () => {
      await sealWith("/foro/hilo/sealed");

      const response = await finishForumLogin(request(`?code=c&state=the-state&next=${encodeURIComponent("https://evil.example")}`));

      expect(location(response)).toBe("https://admin.example.org/foro/hilo/sealed");
    });

    it.each(["https://evil.example/", "//evil.example", "/admin", "/foro/auth/google/start", "/foro\\evil"])("falls back to /foro when the sealed value is not a valid forum path (%s)", async (next) => {
      await sealWith(next);

      expect(location(await finishForumLogin(request("?code=c&state=the-state")))).toBe("https://admin.example.org/foro");
    });

    it("never redirects off the app's own origin, whatever the request URL says", async () => {
      await sealWith("/foro/hilo/abc");

      const response = await finishForumLogin(new Request("https://evil.example/foro/auth/google/callback?code=c&state=the-state"));

      expect(location(response)).toBe("https://admin.example.org/foro/hilo/abc");
    });

    it.each([
      ["a refused account", async () => completeMock.mockResolvedValue({ ...IDENTITY, emailVerified: false }), "denied"],
      ["a rejected token", async () => completeMock.mockRejectedValue(new GoogleAuthError("token")), "failed"],
      ["a Google outage", async () => completeMock.mockRejectedValue(new GoogleAuthError("unavailable")), "verification"],
      ["an unexpected failure", async () => completeMock.mockRejectedValue(new Error("boom")), "unavailable"],
    ])("keeps today's refusal for %s: back to /foro with the code, never to the sealed path", async (_label, arrange, code) => {
      await sealWith("/foro/hilo/abc");
      await arrange();

      expect(location(await finishForumLogin(request("?code=c&state=the-state")))).toBe(`https://admin.example.org/foro?error=${code}`);
      expect(testForum.sessions.sessions.size).toBe(0);
    });

    describe("D5/D8: when the sealed path is an event's registration page", () => {
      it.each([
        ["a refused account", async () => completeMock.mockResolvedValue({ ...IDENTITY, emailVerified: false }), "denied"],
        ["a rejected token", async () => completeMock.mockRejectedValue(new GoogleAuthError("token")), "failed"],
        ["a Google outage", async () => completeMock.mockRejectedValue(new GoogleAuthError("unavailable")), "verification"],
        ["an unexpected failure", async () => completeMock.mockRejectedValue(new Error("boom")), "unavailable"],
      ])("returns to that page with the code for %s, so the refusal is told in registration words", async (_label, arrange, code) => {
        await sealWith("/inscripciones/taller-git");
        await arrange();

        expect(location(await finishForumLogin(request("?code=c&state=the-state")))).toBe(`https://admin.example.org/inscripciones/taller-git?error=${code}`);
        expect(testForum.sessions.sessions.size).toBe(0);
      });

      it("tells a suspended member the generic refusal, never the forum's suspension code, and opens no session", async () => {
        testForum.members.members.set("m1", makeForumMember({ id: "m1", email: "ana@unl.edu.ec", googleSub: "sub-ana", status: "SUSPENDED", suspendedAt: new Date() }));
        await sealWith("/inscripciones/taller-git");

        expect(location(await finishForumLogin(request("?code=c&state=the-state")))).toBe("https://admin.example.org/inscripciones/taller-git?error=denied");
        expect(testForum.sessions.sessions.size).toBe(0);
      });

      it("returns there when the person declines at Google", async () => {
        await sealWith("/inscripciones/taller-git");

        expect(location(await finishForumLogin(request("?error=access_denied&state=the-state")))).toBe("https://admin.example.org/inscripciones/taller-git?error=failed");
      });

      it("keeps the query of the page and adds the code to it", async () => {
        await sealWith("/inscripciones/taller-git?utm=landing");
        completeMock.mockRejectedValue(new GoogleAuthError("token"));

        expect(location(await finishForumLogin(request("?code=c&state=the-state")))).toBe("https://admin.example.org/inscripciones/taller-git?utm=landing&error=failed");
      });
    });

    it("keeps the refusal for a state that does not match, even with a sealed path", async () => {
      await sealWith("/foro/hilo/abc");

      expect(location(await finishForumLogin(request("?code=c&state=forged")))).toBe("https://admin.example.org/foro?error=failed");
    });
  });

  describe("an account that must not get in", () => {
    it.each([
      ["a non-institutional account", { email: "ana@gmail.com", hostedDomain: undefined }],
      ["an institutional address on a personal account (no hd)", { hostedDomain: undefined }],
      ["an hd that does not match", { hostedDomain: "other.edu.ec" }],
      ["an email Google did not verify", { emailVerified: false }],
      ["a look-alike domain", { email: "ana@unl.edu.ec.evil.com", hostedDomain: "unl.edu.ec" }],
    ])("refuses %s: same generic denial, no member, no session, no cookie", async (_label, override) => {
      completeMock.mockResolvedValue({ ...IDENTITY, ...override });

      const response = await finishForumLogin(request("?code=c&state=the-state"));

      expect(location(response)).toBe("https://admin.example.org/foro?error=denied");
      expect(testForum.members.members.size).toBe(0);
      expect(testForum.sessions.sessions.size).toBe(0);
      expect(cookiesSet()).not.toContain(FORUM_COOKIE_NAME);
    });

    it("refuses a suspended member with a code of its own, and still opens no session", async () => {
      testForum.members.members.set("m1", makeForumMember({ id: "m1", email: "ana@unl.edu.ec", googleSub: "sub-ana", status: "SUSPENDED", suspendedAt: new Date() }));

      const response = await finishForumLogin(request("?code=c&state=the-state"));

      expect(location(response)).toBe("https://admin.example.org/foro?error=suspended");
      expect(testForum.sessions.sessions.size).toBe(0);
      expect(cookiesSet()).not.toContain(FORUM_COOKIE_NAME);
    });

    it("refuses everyone when the domain is not configured, even a perfectly institutional account", async () => {
      vi.stubEnv("FORUM_ALLOWED_EMAIL_DOMAIN", "");

      expect(location(await finishForumLogin(request("?code=c&state=the-state")))).toBe("https://admin.example.org/foro?error=unavailable");
      expect(completeMock).not.toHaveBeenCalled();
      expect(testForum.members.members.size).toBe(0);
    });

    it("never logs the reason with an email in it", async () => {
      completeMock.mockResolvedValue({ ...IDENTITY, emailVerified: false });

      await finishForumLogin(request("?code=c&state=the-state"));

      expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("unl.edu.ec");
    });
  });

  describe("a callback that is not this browser's flow", () => {
    it.each([
      ["a state that does not match the cookie", "?code=c&state=forged"],
      ["no state", "?code=c"],
      ["no code", "?state=the-state"],
      ["Google reporting that the user declined", "?error=access_denied&state=the-state"],
    ])("%s: nothing is exchanged and no session opens", async (_label, query) => {
      const response = await finishForumLogin(request(query));

      expect(location(response)).toBe("https://admin.example.org/foro?error=failed");
      expect(completeMock).not.toHaveBeenCalled();
      expect(testForum.sessions.sessions.size).toBe(0);
    });

    it("no flow cookie, a forged one, or the admin's own flow cookie: the same", async () => {
      const adminFlow = await sealOAuthState(FLOW);

      for (const jar of [() => undefined, (name: string) => ({ name, value: `${sealedFlow}x` }), (name: string) => (name === OAUTH_STATE_COOKIE_NAME || name === FORUM_OAUTH_STATE_COOKIE_NAME ? { name, value: adminFlow } : undefined)]) {
        cookieGetMock.mockImplementation(jar);

        expect(location(await finishForumLogin(request("?code=c&state=the-state")))).toBe("https://admin.example.org/foro?error=failed");
      }

      expect(completeMock).not.toHaveBeenCalled();
    });
  });

  describe("when Google fails", () => {
    it("tells an outage (retryable) from a rejected token", async () => {
      completeMock.mockRejectedValueOnce(new GoogleAuthError("unavailable"));
      expect(location(await finishForumLogin(request("?code=c&state=the-state")))).toBe("https://admin.example.org/foro?error=verification");

      completeMock.mockRejectedValueOnce(new GoogleAuthError("token"));
      expect(location(await finishForumLogin(request("?code=c&state=the-state")))).toBe("https://admin.example.org/foro?error=failed");

      completeMock.mockRejectedValueOnce(new Error("boom"));
      expect(location(await finishForumLogin(request("?code=c&state=the-state")))).toBe("https://admin.example.org/foro?error=unavailable");
      expect(testForum.sessions.sessions.size).toBe(0);
    });
  });
});

describe("the admin Google login, with the forum configured next to it (regression)", () => {
  beforeEach(() => {
    throttleTargetMock.mockResolvedValue({ key: "203.0.113.5", deviceId: undefined });
    consumeMock.mockResolvedValue({ allowed: true, retryAfterSeconds: 0 });
    adminOpenSessionMock.mockResolvedValue({ sessionId: "session-1" });
  });

  it("still starts with the admin's own cookie, path and redirect URI", async () => {
    startMock.mockReturnValue({ url: new URL("https://accounts.google.com/o/oauth2/v2/auth"), ...FLOW });

    await startGoogleLogin(new Request("https://admin.example.org/auth/google/start"));

    expect(startMock).toHaveBeenCalledWith({ clientId: "client-id", clientSecret: "client-secret", redirectUri: "https://admin.example.org/auth/google/callback" });
    expect(cookieSetMock.mock.calls[0]).toMatchObject([OAUTH_STATE_COOKIE_NAME, expect.any(String), { httpOnly: true, sameSite: "lax", path: "/auth/google", maxAge: 600 }]);
  });

  it("still logs a registered user into /admin, with the new sub claim ignored, and creates no forum member", async () => {
    testAuth.users.users.set("ana", makeUser({ id: "ana", email: "ana@example.org", role: "EDITOR" }));
    completeMock.mockResolvedValue({ email: "ana@example.org", emailVerified: true, name: "Ana", subject: "sub-ana" });
    cookieGetMock.mockImplementation((name: string) => (name === OAUTH_STATE_COOKIE_NAME ? { name, value: sealedAdminFlow } : undefined));

    const response = await finishGoogleLogin(new Request("https://admin.example.org/auth/google/callback?code=c&state=the-state"));

    expect(location(response)).toBe("https://admin.example.org/admin");
    expect(adminOpenSessionMock).toHaveBeenCalledWith({ kind: "user", userId: "ana" }, "EDITOR");
    expect(testForum.members.members.size).toBe(0);
    expect(cookiesSet()).not.toContain(FORUM_COOKIE_NAME);
  });

  it("ignores a forum return path at the admin login: still /admin", async () => {
    testAuth.users.users.set("ana", makeUser({ id: "ana", email: "ana@example.org", role: "EDITOR" }));
    completeMock.mockResolvedValue({ email: "ana@example.org", emailVerified: true, name: "Ana", subject: "sub-ana" });
    cookieGetMock.mockImplementation((name: string) => (name === OAUTH_STATE_COOKIE_NAME ? { name, value: sealedAdminFlow } : undefined));

    const response = await finishGoogleLogin(new Request(`https://admin.example.org/auth/google/callback?code=c&state=the-state&next=${encodeURIComponent("/foro/hilo/abc")}`));

    expect(location(response)).toBe("https://admin.example.org/admin");
  });

  it("does not seal a next into the admin flow cookie", async () => {
    startMock.mockReturnValue({ url: new URL("https://accounts.google.com/o/oauth2/v2/auth"), ...FLOW });

    await startGoogleLogin(new Request(`https://admin.example.org/auth/google/start?next=${encodeURIComponent("/foro/hilo/abc")}`));

    const sealed = cookieSetMock.mock.calls[0]?.[1] as string;
    expect(await openForumOAuthState(sealed)).toBeNull();
    expect(Buffer.from(sealed.split(".")[1] ?? "", "base64url").toString()).not.toContain("next");
  });

  it("still refuses a forum-flow cookie at the admin callback", async () => {
    cookieGetMock.mockImplementation((name: string) => ({ name, value: sealedFlow }));

    const response = await finishGoogleLogin(new Request("https://admin.example.org/auth/google/callback?code=c&state=the-state"));

    expect(location(response)).toBe("https://admin.example.org/login?error=failed");
    expect(adminOpenSessionMock).not.toHaveBeenCalled();
  });
});
