import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Differential baseline for T2b. The table below was observed on the code
// BEFORE the login throttle moved to Postgres (commit cf2cffa) and must hold,
// unchanged, after it: valid login, wrong password, empty password, logout and
// the middleware redirects. The throttle is stubbed permissive so only the
// unchanged paths are compared; its new behaviour has its own tests.
//
// T2c adds exactly two things to the harness, nothing to the expectations: the
// stubbed cookie store can now be read (`get`, the login looks for the
// known-device cookie), and a successful login sets a second cookie (the
// known-device one), so the session cookie is picked out by name.

const { redirectMock, cookieSetMock, headersGetMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
  cookieSetMock: vi.fn(),
  headersGetMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => ({ get: headersGetMock })),
  cookies: vi.fn(async () => ({ set: cookieSetMock, get: () => undefined })),
}));
// Permissive stand-in that serves both the old (sync) and the new (async) throttle API.
vi.mock("@/infrastructure/auth/login-rate-limiter", () => ({
  checkLoginRate: () => ({ allowed: true, retryAfterSeconds: 0 }),
  recordFailedLogin: () => undefined,
  consumeLoginAttempt: async () => ({ allowed: true, retryAfterSeconds: 0 }),
  recordSuccessfulLogin: async () => undefined,
}));

import { AUTH_COOKIE_NAME } from "@/infrastructure/auth/session-jwt";
import { config } from "../../../../../middleware";
import { TEST_SECRET, buildRequest, signTestToken } from "../../middleware/support";

// Fresh modules per test: the session secret "reported once" latch lives in the module graph.
let verifySession: typeof import("@/infrastructure/auth/session-jwt").verifySession;
let login: typeof import("@/interface/auth/actions").login;
let logout: typeof import("@/interface/auth/actions").logout;
let middleware: typeof import("../../../../../middleware").middleware;

function passwordForm(password: string | null): FormData {
  const formData = new FormData();
  if (password !== null) formData.set("password", password);
  return formData;
}

describe("auth behaviour baseline (unchanged by T2b)", () => {
  beforeEach(async () => {
    vi.resetModules();
    ({ verifySession } = await import("@/infrastructure/auth/session-jwt"));
    ({ login, logout } = await import("@/interface/auth/actions"));
    ({ middleware } = await import("../../../../../middleware"));
    vi.stubEnv("ADMIN_PASSWORD", "correct horse battery staple");
    vi.stubEnv("ADMIN_SECRET", TEST_SECRET);
    headersGetMock.mockImplementation((name: string) => (name === "x-real-ip" ? "203.0.113.5" : null));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("valid password: signs a session, sets the httpOnly cookie and redirects to /admin", async () => {
    await expect(login(null, passwordForm("correct horse battery staple"))).rejects.toThrow("REDIRECT:/admin");

    const sessionCalls = cookieSetMock.mock.calls.filter(([cookieName]) => cookieName === AUTH_COOKIE_NAME);
    expect(sessionCalls).toHaveLength(1);
    const [name, token, options] = sessionCalls[0] as [string, string, Record<string, unknown>];
    expect(name).toBe(AUTH_COOKIE_NAME);
    expect(options).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/", maxAge: 86400 });
    expect(await verifySession(token)).toMatchObject({ valid: true, payload: { sub: "admin" } });
  });

  it.each([
    ["a wrong password", "nope"],
    ["an empty password", ""],
    ["a missing password field", null],
  ])("%s: generic error, no cookie, no redirect", async (_label, password) => {
    await expect(login(null, passwordForm(password))).resolves.toEqual({ error: "Contraseña incorrecta.", field: "password" });

    expect(cookieSetMock).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("an invalid ADMIN_SECRET still reports the service as unavailable and sets no cookie", async () => {
    vi.stubEnv("ADMIN_SECRET", "short");
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(login(null, passwordForm("correct horse battery staple"))).resolves.toEqual({
      error: "El acceso no está disponible en este momento. Intente de nuevo en unos minutos.",
    });
    expect(cookieSetMock).not.toHaveBeenCalled();
  });

  it("logout clears the cookie (maxAge 0) and redirects to /login", async () => {
    await expect(logout()).rejects.toThrow("REDIRECT:/login");

    expect(cookieSetMock).toHaveBeenCalledWith(AUTH_COOKIE_NAME, "", expect.objectContaining({ maxAge: 0, httpOnly: true, path: "/" }));
  });

  describe("middleware", () => {
    it("keeps the same matcher", () => {
      expect(config.matcher).toEqual(["/", "/admin/:path*"]);
    });

    it.each(["/", "/admin", "/admin/events", "/admin/board/x/edit"])("%s: no cookie, bad cookie and expired cookie redirect to /login; a valid one passes", async (path) => {
      const valid = await signTestToken(86400);
      const expired = await signTestToken(-100);
      const forged = await signTestToken(86400, "y".repeat(32));
      const table: Record<string, [number, string | null, string | null]> = {};

      for (const [label, cookie] of Object.entries({ none: undefined, invalid: "invalid", expired, forged, valid })) {
        const response = await middleware(buildRequest(path, cookie));
        table[label] = [response.status, response.headers.get("location"), response.headers.get("x-middleware-next")];
      }

      expect(table).toEqual({
        none: [307, "http://localhost:3000/login", null],
        invalid: [307, "http://localhost:3000/login", null],
        expired: [307, "http://localhost:3000/login", null],
        forged: [307, "http://localhost:3000/login", null],
        valid: [200, null, "1"],
      });
    });

    it("API paths answer 401 JSON without a session and 503 when the secret is invalid", async () => {
      const unauthorized = await middleware(buildRequest("/api/admin/x"));
      expect([unauthorized.status, await unauthorized.json()]).toEqual([401, { error: "Unauthorized" }]);

      vi.stubEnv("ADMIN_SECRET", "");
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      const unavailable = await middleware(buildRequest("/admin"));
      expect([unavailable.status, await unavailable.text()]).toEqual([503, "<h1>Service unavailable</h1>"]);
    });
  });
});
