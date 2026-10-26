import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookieSetMock, cookieDeleteMock, cookieGetMock, openSessionMock, consumeMock, recordSuccessMock, completeMock, startMock, reportErrorMock, throttleTargetMock } = vi.hoisted(() => ({
  cookieSetMock: vi.fn(),
  cookieDeleteMock: vi.fn(),
  cookieGetMock: vi.fn(),
  openSessionMock: vi.fn(),
  consumeMock: vi.fn(),
  recordSuccessMock: vi.fn(),
  completeMock: vi.fn(),
  startMock: vi.fn(),
  reportErrorMock: vi.fn(),
  throttleTargetMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({ set: cookieSetMock, delete: cookieDeleteMock, get: cookieGetMock })) }));
vi.mock("@/interface/auth/session-lifecycle", () => ({ openSession: openSessionMock }));
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
import { finishGoogleLogin, startGoogleLogin } from "@/interface/auth/google-login";
import { makeUser } from "@/tests/fakes/in-memory-auth";
import { testAuth } from "@/tests/support/test-auth";

const GOOGLE_ENV = { GOOGLE_CLIENT_ID: "client-id", GOOGLE_CLIENT_SECRET: "client-secret", AUTH_URL: "https://admin.example.org", ADMIN_SECRET: "s".repeat(40) };
const FLOW = { state: "the-state", codeVerifier: "the-verifier", nonce: "the-nonce" };

const request = (query: string) => new Request(`https://admin.example.org/auth/google/callback${query}`);
const location = (response: Response) => response.headers.get("location");

async function withState(flow = FLOW) {
  cookieGetMock.mockImplementation((name: string) => (name === OAUTH_STATE_COOKIE_NAME ? { name, value: sealedFlow } : undefined));
  void flow;
}

let sealedFlow = "";

beforeEach(async () => {
  vi.clearAllMocks();
  for (const [name, value] of Object.entries(GOOGLE_ENV)) vi.stubEnv(name, value);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  sealedFlow = await sealOAuthState(FLOW);
  await withState();
  throttleTargetMock.mockResolvedValue({ key: "203.0.113.5", deviceId: undefined });
  consumeMock.mockResolvedValue({ allowed: true, retryAfterSeconds: 0 });
  completeMock.mockResolvedValue({ email: "ana@example.org", emailVerified: true, name: "Ana" });
  openSessionMock.mockResolvedValue({ sessionId: "session-1" });
  testAuth.users.users.set("ana", makeUser({ id: "ana", email: "ana@example.org", role: "EDITOR" }));
});

describe("startGoogleLogin", () => {
  it("goes back to the login page when Google is not configured, setting nothing", async () => {
    vi.unstubAllEnvs();
    vi.stubEnv("ADMIN_SECRET", GOOGLE_ENV.ADMIN_SECRET);

    const response = await startGoogleLogin(new Request("https://admin.example.org/auth/google/start"));

    expect(location(response)).toBe("https://admin.example.org/login");
    expect(cookieSetMock).not.toHaveBeenCalled();
    expect(startMock).not.toHaveBeenCalled();
  });

  it("redirects to Google and keeps state, verifier and nonce in a sealed httpOnly cookie for this flow only", async () => {
    startMock.mockReturnValue({ url: new URL("https://accounts.google.com/o/oauth2/v2/auth?state=the-state"), ...FLOW });

    const response = await startGoogleLogin(new Request("https://admin.example.org/auth/google/start"));

    expect(response.status).toBe(307);
    expect(location(response)).toBe("https://accounts.google.com/o/oauth2/v2/auth?state=the-state");
    expect(startMock).toHaveBeenCalledWith({ clientId: "client-id", clientSecret: "client-secret", redirectUri: "https://admin.example.org/auth/google/callback" });

    const [name, value, options] = cookieSetMock.mock.calls[0] as [string, string, Record<string, unknown>];
    expect(name).toBe(OAUTH_STATE_COOKIE_NAME);
    expect(value).not.toContain("the-verifier");
    expect(options).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/auth/google", maxAge: 600 });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("says the access is unavailable, not a crash, when the flow cannot be sealed", async () => {
    startMock.mockReturnValue({ url: new URL("https://accounts.google.com/x"), ...FLOW });
    vi.stubEnv("ADMIN_SECRET", "short");

    expect(location(await startGoogleLogin(new Request("https://admin.example.org/auth/google/start")))).toBe("https://admin.example.org/login?error=unavailable");
  });
});

describe("finishGoogleLogin", () => {
  it("logs a registered, active user in: exchanges the code with the cookie's verifier and nonce, opens a session and goes to the admin", async () => {
    const response = await finishGoogleLogin(request("?code=auth-code&state=the-state"));

    expect(location(response)).toBe("https://admin.example.org/admin");
    expect(completeMock).toHaveBeenCalledWith(expect.objectContaining({ code: "auth-code", codeVerifier: "the-verifier", nonce: "the-nonce", clientId: "client-id" }));
    expect(openSessionMock).toHaveBeenCalledWith({ kind: "user", userId: "ana" }, "EDITOR");
    expect(recordSuccessMock).toHaveBeenCalledWith("203.0.113.5");
    expect(testAuth.audit.entries.map((entry) => [entry.action, entry.actorKind, entry.actorUserId, entry.entityId])).toEqual([["login.success", "user", "ana", "session-1"]]);
  });

  it("always clears the flow cookie, so a callback URL cannot be replayed", async () => {
    await finishGoogleLogin(request("?code=auth-code&state=the-state"));
    await finishGoogleLogin(request("?code=auth-code&state=wrong"));

    expect(cookieDeleteMock).toHaveBeenCalledTimes(2);
    expect(cookieDeleteMock).toHaveBeenCalledWith(expect.objectContaining({ name: OAUTH_STATE_COOKIE_NAME, path: "/auth/google" }));
  });

  describe("a callback that is not this browser's flow", () => {
    it.each([
      ["a state that does not match the cookie", "?code=c&state=forged"],
      ["no state", "?code=c"],
      ["no code", "?state=the-state"],
      ["Google reporting that the user declined", "?error=access_denied&state=the-state"],
    ])("%s: nothing is exchanged and no session opens", async (_label, query) => {
      const response = await finishGoogleLogin(request(query));

      expect(location(response)).toBe("https://admin.example.org/login?error=failed");
      expect(completeMock).not.toHaveBeenCalled();
      expect(openSessionMock).not.toHaveBeenCalled();
      expect(testAuth.audit.entries.map((entry) => [entry.action, entry.actorKind])).toEqual([["login.failure", "system"]]);
    });

    it("no flow cookie at all (expired, another browser): the same", async () => {
      cookieGetMock.mockReturnValue(undefined);

      expect(location(await finishGoogleLogin(request("?code=c&state=the-state")))).toBe("https://admin.example.org/login?error=failed");
      expect(completeMock).not.toHaveBeenCalled();
    });

    it("a forged flow cookie: the same", async () => {
      cookieGetMock.mockImplementation((name: string) => ({ name, value: `${sealedFlow}x` }));

      expect(location(await finishGoogleLogin(request("?code=c&state=the-state")))).toBe("https://admin.example.org/login?error=failed");
    });
  });

  describe("an account that must not get in", () => {
    const attempt = async (identity: { email: string; emailVerified: boolean }) => {
      vi.clearAllMocks();
      completeMock.mockResolvedValue(identity);
      openSessionMock.mockResolvedValue({ sessionId: "session-1" });
      consumeMock.mockResolvedValue({ allowed: true, retryAfterSeconds: 0 });
      throttleTargetMock.mockResolvedValue({ key: "k", deviceId: undefined });
      cookieGetMock.mockImplementation((name: string) => (name === OAUTH_STATE_COOKIE_NAME ? { name, value: sealedFlow } : undefined));

      return finishGoogleLogin(request("?code=c&state=the-state"));
    };

    it("answers an unknown email, a deactivated user and an unverified email in exactly the same way (no user enumeration)", async () => {
      testAuth.users.users.set("off", makeUser({ id: "off", email: "off@example.org", active: false }));
      const unknown = await attempt({ email: "stranger@example.org", emailVerified: true });
      const inactive = await attempt({ email: "off@example.org", emailVerified: true });
      const unverified = await attempt({ email: "ana@example.org", emailVerified: false });

      for (const response of [unknown, inactive, unverified]) {
        expect(response.status).toBe(307);
        expect(location(response)).toBe("https://admin.example.org/login?error=denied");
      }

      expect(openSessionMock).not.toHaveBeenCalled();
    });

    it("writes a failure entry that names neither the email nor the reason's subject, and sets no cookie", async () => {
      await attempt({ email: "stranger@example.org", emailVerified: true });

      expect(testAuth.audit.entries).toHaveLength(1);
      expect(testAuth.audit.entries[0]).toMatchObject({ action: "login.failure", actorKind: "system", actorUserId: null });
      expect(JSON.stringify(testAuth.audit.entries)).not.toMatch(/stranger|@/);
      expect(cookieSetMock).not.toHaveBeenCalled();
      expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("stranger");
    });

    it("does not clear the throttle for a refused account", async () => {
      await attempt({ email: "stranger@example.org", emailVerified: true });

      expect(recordSuccessMock).not.toHaveBeenCalled();
    });
  });

  describe("failures on the way", () => {
    it("a failed exchange or an invalid ID token ends in the generic failure, reported without the code or any token", async () => {
      const failure = new GoogleAuthError("token");
      completeMock.mockRejectedValue(failure);

      expect(location(await finishGoogleLogin(request("?code=secret-code&state=the-state")))).toBe("https://admin.example.org/login?error=failed");

      expect(reportErrorMock).toHaveBeenCalledWith(failure, { action: "google-login", failure: "token" });
      expect(JSON.stringify([...vi.mocked(console.error).mock.calls, ...reportErrorMock.mock.calls.map(([error]) => String(error))])).not.toContain("secret-code");
      expect(openSessionMock).not.toHaveBeenCalled();
      expect(testAuth.audit.entries.map((entry) => entry.action)).toEqual(["login.failure"]);
    });

    it("an outage on Google's side is a retryable message, reported, and not written as a refused login", async () => {
      const failure = new GoogleAuthError("unavailable");
      completeMock.mockRejectedValue(failure);

      expect(location(await finishGoogleLogin(request("?code=secret-code&state=the-state")))).toBe("https://admin.example.org/login?error=verification");

      expect(reportErrorMock).toHaveBeenCalledWith(failure, { action: "google-login", failure: "unavailable" });
      expect(openSessionMock).not.toHaveBeenCalled();
      expect(testAuth.audit.entries).toEqual([]);
    });

    it("a throttled client is stopped before anything is exchanged", async () => {
      consumeMock.mockResolvedValue({ allowed: false, retryAfterSeconds: 60 });

      expect(location(await finishGoogleLogin(request("?code=c&state=the-state")))).toBe("https://admin.example.org/login?error=throttled");
      expect(completeMock).not.toHaveBeenCalled();
      expect(testAuth.audit.entries).toEqual([]);
    });

    it("fails closed when the throttle store is down", async () => {
      consumeMock.mockRejectedValue(new Error("connection refused"));

      expect(location(await finishGoogleLogin(request("?code=c&state=the-state")))).toBe("https://admin.example.org/login?error=unavailable");
      expect(completeMock).not.toHaveBeenCalled();
      expect(reportErrorMock).toHaveBeenCalledWith(expect.any(Error), { action: "login-throttle" });
    });

    it("a failure opening the session is a service-unavailable error, not a crash", async () => {
      openSessionMock.mockRejectedValue(new Error("db down"));

      expect(location(await finishGoogleLogin(request("?code=c&state=the-state")))).toBe("https://admin.example.org/login?error=unavailable");
      expect(testAuth.audit.entries).toEqual([]);
    });

    it("an audit failure does not block a correct login, and a throttle-clearing failure neither", async () => {
      testAuth.audit.failWith = new Error("db down");
      recordSuccessMock.mockRejectedValue(new Error("db down"));

      expect(location(await finishGoogleLogin(request("?code=c&state=the-state")))).toBe("https://admin.example.org/admin");
    });

    it("goes back to the plain login page when Google is not configured", async () => {
      vi.unstubAllEnvs();

      expect(location(await finishGoogleLogin(request("?code=c&state=the-state")))).toBe("https://admin.example.org/login");
      expect(completeMock).not.toHaveBeenCalled();
    });
  });
});
