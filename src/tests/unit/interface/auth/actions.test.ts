import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  redirectMock,
  comparePasswordMock,
  getAdminPasswordMock,
  signSessionMock,
  setSessionCookieMock,
  clearSessionCookieMock,
  SessionSecretErrorMock,
  reportSessionSecretMisconfigurationMock,
  headersGetMock,
  consumeLoginAttemptMock,
  recordSuccessfulLoginMock,
  reportUnknownLoginClientMock,
  reportAdminPasswordMisconfigurationMock,
} = vi.hoisted(() => ({
  redirectMock: vi.fn(() => {
    throw new Error("REDIRECT");
  }),
  comparePasswordMock: vi.fn(),
  getAdminPasswordMock: vi.fn(),
  signSessionMock: vi.fn(),
  setSessionCookieMock: vi.fn(),
  clearSessionCookieMock: vi.fn(),
  SessionSecretErrorMock: class SessionSecretError extends Error {},
  reportSessionSecretMisconfigurationMock: vi.fn(),
  headersGetMock: vi.fn(),
  consumeLoginAttemptMock: vi.fn(),
  recordSuccessfulLoginMock: vi.fn(),
  reportUnknownLoginClientMock: vi.fn(),
  reportAdminPasswordMisconfigurationMock: vi.fn(),
}));

// actions.ts imports the real client IP resolver from client-ip.ts, which is
// marked "server-only"; neutralize that guard in the unit env.
vi.mock("server-only", () => ({}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => ({ get: headersGetMock })),
}));

vi.mock("@/infrastructure/auth/login-rate-limiter", () => ({
  consumeLoginAttempt: consumeLoginAttemptMock,
  recordSuccessfulLogin: recordSuccessfulLoginMock,
  reportUnknownLoginClient: reportUnknownLoginClientMock,
}));

vi.mock("@/infrastructure/auth/password", () => ({
  comparePassword: comparePasswordMock,
  getAdminPassword: getAdminPasswordMock,
  reportAdminPasswordMisconfiguration: reportAdminPasswordMisconfigurationMock,
}));

vi.mock("@/infrastructure/auth/session-jwt", () => ({
  signSession: signSessionMock,
  SessionSecretError: SessionSecretErrorMock,
  reportSessionSecretMisconfiguration: reportSessionSecretMisconfigurationMock,
}));

vi.mock("@/infrastructure/auth/session-cookies", () => ({
  setSessionCookie: setSessionCookieMock,
  clearSessionCookie: clearSessionCookieMock,
}));

import { login, logout } from "@/interface/auth/actions";

function formDataWith(password: string | null): FormData {
  const formData = new FormData();
  if (password !== null) {
    formData.set("password", password);
  }
  return formData;
}

function setHeaders(values: Record<string, string>): void {
  headersGetMock.mockImplementation((name: string) => values[name] ?? null);
}

describe("auth actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAdminPasswordMock.mockReturnValue("correct-password");
    headersGetMock.mockImplementation((name: string) => (name === "x-real-ip" ? "203.0.113.5" : null));
    consumeLoginAttemptMock.mockResolvedValue({ allowed: true, retryAfterSeconds: 0 });
  });

  it("ACTION-001: login correcto firma sesión, setea cookie y redirige al dashboard /admin", async () => {
    comparePasswordMock.mockReturnValue(true);
    signSessionMock.mockResolvedValue("token");

    await expect(login(null, formDataWith("correct-password"))).rejects.toThrow("REDIRECT");

    expect(comparePasswordMock).toHaveBeenCalledWith("correct-password", "correct-password");
    expect(signSessionMock).toHaveBeenCalled();
    expect(setSessionCookieMock).toHaveBeenCalledWith("token");
    expect(redirectMock).toHaveBeenCalledWith("/admin");
  });

  it("ACTION-002: login incorrecto retorna error genérico y no firma sesión", async () => {
    comparePasswordMock.mockReturnValue(false);

    const result = await login(null, formDataWith("wrong-password"));

    expect(result).toEqual({ error: "Contraseña incorrecta." });
    expect(signSessionMock).not.toHaveBeenCalled();
  });

  it("ACTION-003: login con campo vacío retorna error genérico", async () => {
    const result = await login(null, formDataWith(""));

    expect(result).toEqual({ error: "Contraseña incorrecta." });
  });

  it("ACTION-004: logout limpia cookie y redirige a /login", async () => {
    await expect(logout()).rejects.toThrow("REDIRECT");

    expect(clearSessionCookieMock).toHaveBeenCalled();
    expect(redirectMock).toHaveBeenCalledWith("/login");
  });

  it("ACTION-005: a missing ADMIN_PASSWORD fails closed, reports the misconfiguration and never touches the throttle", async () => {
    getAdminPasswordMock.mockImplementation(() => {
      throw new Error("ADMIN_PASSWORD must be defined and non-empty.");
    });

    const result = await login(null, formDataWith("any-password"));

    expect(result).toEqual({ error: "Authentication service is temporarily unavailable." });
    expect(reportAdminPasswordMisconfigurationMock).toHaveBeenCalledTimes(1);
    expect(consumeLoginAttemptMock).not.toHaveBeenCalled();
    expect(comparePasswordMock).not.toHaveBeenCalled();
    expect(signSessionMock).not.toHaveBeenCalled();
    expect(setSessionCookieMock).not.toHaveBeenCalled();
  });

  it("ACTION-006: formData.get('password') null retorna error genérico", async () => {
    const result = await login(null, formDataWith(null));

    expect(result).toEqual({ error: "Contraseña incorrecta." });
  });

  it("returns a service-unavailable error when ADMIN_SECRET is invalid", async () => {
    comparePasswordMock.mockReturnValue(true);
    signSessionMock.mockRejectedValue(new SessionSecretErrorMock("invalid secret"));

    const result = await login(null, formDataWith("correct-password"));

    expect(result).toEqual({ error: "Authentication service is temporarily unavailable." });
    expect(setSessionCookieMock).not.toHaveBeenCalled();
    expect(reportSessionSecretMisconfigurationMock).toHaveBeenCalledTimes(1);
  });

  it("ACTION-007: rejects a rate-limited client without checking the password", async () => {
    consumeLoginAttemptMock.mockResolvedValue({ allowed: false, retryAfterSeconds: 900 });

    const result = await login(null, formDataWith("correct-password"));

    expect(result).toEqual({ error: "Demasiados intentos. Intente de nuevo más tarde." });
    expect(comparePasswordMock).not.toHaveBeenCalled();
    expect(signSessionMock).not.toHaveBeenCalled();
    expect(recordSuccessfulLoginMock).not.toHaveBeenCalled();
  });

  it("ACTION-008: spends one attempt against the client IP BEFORE comparing the password (parallel guesses cannot skip the count)", async () => {
    comparePasswordMock.mockReturnValue(false);
    const order: string[] = [];
    consumeLoginAttemptMock.mockImplementation(async () => {
      order.push("consume");
      return { allowed: true, retryAfterSeconds: 0 };
    });
    comparePasswordMock.mockImplementation(() => {
      order.push("compare");
      return false;
    });

    await login(null, formDataWith("wrong-password"));

    expect(consumeLoginAttemptMock).toHaveBeenCalledWith("203.0.113.5");
    expect(order).toEqual(["consume", "compare"]);
    expect(recordSuccessfulLoginMock).not.toHaveBeenCalled();
  });

  it("ACTION-009: clears the throttle for the client IP on a successful login", async () => {
    comparePasswordMock.mockReturnValue(true);
    signSessionMock.mockResolvedValue("token");

    await expect(login(null, formDataWith("correct-password"))).rejects.toThrow("REDIRECT");

    expect(recordSuccessfulLoginMock).toHaveBeenCalledWith("203.0.113.5");
  });

  it("ACTION-010: keys the throttle by x-real-ip, ignoring a spoofed multi-hop x-forwarded-for", async () => {
    // Vercel overwrites both headers with the client IP, so x-real-ip is
    // authoritative. A forged chain must not be able to rotate the key and
    // evade the login lockout.
    setHeaders({ "x-real-ip": "203.0.113.9", "x-forwarded-for": "6.6.6.6, 7.7.7.7, 8.8.8.8" });
    comparePasswordMock.mockReturnValue(false);

    await login(null, formDataWith("wrong-password"));

    expect(consumeLoginAttemptMock).toHaveBeenCalledWith("203.0.113.9");
  });

  it("ACTION-011: falls back to the FIRST x-forwarded-for entry when x-real-ip is absent", async () => {
    setHeaders({ "x-forwarded-for": " 203.0.113.9 , 10.0.0.1, " });
    comparePasswordMock.mockReturnValue(false);

    await login(null, formDataWith("wrong-password"));

    expect(consumeLoginAttemptMock).toHaveBeenCalledWith("203.0.113.9");
  });

  it("ACTION-012: falls back to 'unknown' when no client IP header is present", async () => {
    setHeaders({});
    comparePasswordMock.mockReturnValue(false);

    await login(null, formDataWith("wrong-password"));

    expect(consumeLoginAttemptMock).toHaveBeenCalledWith("unknown");
    expect(reportUnknownLoginClientMock).toHaveBeenCalledTimes(1);
  });

  it("ACTION-013: a known client IP does not trigger the unknown-client report", async () => {
    comparePasswordMock.mockReturnValue(false);

    await login(null, formDataWith("wrong-password"));

    expect(reportUnknownLoginClientMock).not.toHaveBeenCalled();
  });

  it("ACTION-014: fails closed, without comparing the password, when the throttle store is down", async () => {
    consumeLoginAttemptMock.mockRejectedValue(new Error("connection refused"));
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const result = await login(null, formDataWith("correct-password"));

    expect(result).toEqual({ error: "Authentication service is temporarily unavailable." });
    expect(comparePasswordMock).not.toHaveBeenCalled();
    expect(signSessionMock).not.toHaveBeenCalled();
    expect(setSessionCookieMock).not.toHaveBeenCalled();
    expect(errorLog).toHaveBeenCalledWith(expect.stringContaining("login throttle"), expect.any(Error));
    errorLog.mockRestore();
  });

  it("ACTION-015: a throttle failure while clearing it after a good login does not block the login", async () => {
    comparePasswordMock.mockReturnValue(true);
    signSessionMock.mockResolvedValue("token");
    recordSuccessfulLoginMock.mockRejectedValue(new Error("connection refused"));
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(login(null, formDataWith("correct-password"))).rejects.toThrow("REDIRECT");

    expect(setSessionCookieMock).toHaveBeenCalledWith("token");
    errorLog.mockRestore();
  });
});
