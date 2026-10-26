import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  redirectMock,
  comparePasswordMock,
  getAdminPasswordMock,
  openSessionMock,
  closeSessionMock,
  SessionSecretErrorMock,
  reportSessionSecretMisconfigurationMock,
  headersGetMock,
  consumeLoginAttemptMock,
  recordSuccessfulLoginMock,
  reportUnknownLoginClientMock,
  reportAdminPasswordMisconfigurationMock,
  readKnownDeviceTokenMock,
  setKnownDeviceCookieMock,
  verifyKnownDeviceMock,
  signKnownDeviceMock,
  newDeviceIdMock,
} = vi.hoisted(() => ({
  redirectMock: vi.fn(() => {
    throw new Error("REDIRECT");
  }),
  comparePasswordMock: vi.fn(),
  getAdminPasswordMock: vi.fn(),
  openSessionMock: vi.fn(),
  closeSessionMock: vi.fn(),
  SessionSecretErrorMock: class SessionSecretError extends Error {},
  reportSessionSecretMisconfigurationMock: vi.fn(),
  headersGetMock: vi.fn(),
  consumeLoginAttemptMock: vi.fn(),
  recordSuccessfulLoginMock: vi.fn(),
  reportUnknownLoginClientMock: vi.fn(),
  reportAdminPasswordMisconfigurationMock: vi.fn(),
  readKnownDeviceTokenMock: vi.fn(),
  setKnownDeviceCookieMock: vi.fn(),
  verifyKnownDeviceMock: vi.fn(),
  signKnownDeviceMock: vi.fn(),
  newDeviceIdMock: vi.fn(),
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

vi.mock("@/interface/auth/session-lifecycle", () => ({
  openSession: openSessionMock,
  closeSession: closeSessionMock,
}));

vi.mock("@/infrastructure/auth/session-jwt", () => ({
  SessionSecretError: SessionSecretErrorMock,
  reportSessionSecretMisconfiguration: reportSessionSecretMisconfigurationMock,
}));

vi.mock("@/infrastructure/auth/known-device", () => ({
  verifyKnownDevice: verifyKnownDeviceMock,
  signKnownDevice: signKnownDeviceMock,
  newDeviceId: newDeviceIdMock,
  deviceThrottleKey: (id: string) => `device:${id}`,
}));

vi.mock("@/infrastructure/auth/known-device-cookies", () => ({
  readKnownDeviceToken: readKnownDeviceTokenMock,
  setKnownDeviceCookie: setKnownDeviceCookieMock,
}));

import { testAuth } from "@/tests/support/test-auth";
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
    readKnownDeviceTokenMock.mockResolvedValue(undefined);
    verifyKnownDeviceMock.mockResolvedValue({ valid: false });
    signKnownDeviceMock.mockResolvedValue("device-token");
    newDeviceIdMock.mockReturnValue("fresh-device-id");
  });

  it("ACTION-001: login correcto firma sesión, setea cookie y redirige al dashboard /admin", async () => {
    comparePasswordMock.mockReturnValue(true);
    openSessionMock.mockResolvedValue({ sessionId: "session-1" });

    await expect(login(null, formDataWith("correct-password"))).rejects.toThrow("REDIRECT");

    expect(comparePasswordMock).toHaveBeenCalledWith("correct-password", "correct-password");
    expect(openSessionMock).toHaveBeenCalledWith({ kind: "break_glass" }, "ADMIN");
    expect(redirectMock).toHaveBeenCalledWith("/admin");
  });

  it("ACTION-002: login incorrecto retorna error genérico y no firma sesión", async () => {
    comparePasswordMock.mockReturnValue(false);

    const result = await login(null, formDataWith("wrong-password"));

    expect(result).toEqual({ error: "Contraseña incorrecta.", field: "password" });
    expect(openSessionMock).not.toHaveBeenCalled();
  });

  it("ACTION-003: login con campo vacío retorna error genérico", async () => {
    const result = await login(null, formDataWith(""));

    expect(result).toEqual({ error: "Contraseña incorrecta.", field: "password" });
  });

  it("ACTION-004: logout limpia cookie y redirige a /login", async () => {
    await expect(logout()).rejects.toThrow("REDIRECT");

    expect(closeSessionMock).toHaveBeenCalled();
    expect(redirectMock).toHaveBeenCalledWith("/login");
  });

  it("ACTION-005: a missing ADMIN_PASSWORD fails closed, reports the misconfiguration and never touches the throttle", async () => {
    getAdminPasswordMock.mockImplementation(() => {
      throw new Error("ADMIN_PASSWORD must be defined and non-empty.");
    });

    const result = await login(null, formDataWith("any-password"));

    expect(result).toEqual({ error: "El acceso no está disponible en este momento. Intente de nuevo en unos minutos." });
    expect(reportAdminPasswordMisconfigurationMock).toHaveBeenCalledTimes(1);
    expect(consumeLoginAttemptMock).not.toHaveBeenCalled();
    expect(comparePasswordMock).not.toHaveBeenCalled();
    expect(openSessionMock).not.toHaveBeenCalled();
  });

  it("ACTION-006: formData.get('password') null retorna error genérico", async () => {
    const result = await login(null, formDataWith(null));

    expect(result).toEqual({ error: "Contraseña incorrecta.", field: "password" });
  });

  it("returns a service-unavailable error when ADMIN_SECRET is invalid", async () => {
    comparePasswordMock.mockReturnValue(true);
    openSessionMock.mockRejectedValue(new SessionSecretErrorMock("invalid secret"));

    const result = await login(null, formDataWith("correct-password"));

    expect(result).toEqual({ error: "El acceso no está disponible en este momento. Intente de nuevo en unos minutos." });
    expect(reportSessionSecretMisconfigurationMock).toHaveBeenCalledTimes(1);
  });

  it("ACTION-007: rejects a rate-limited client without checking the password", async () => {
    consumeLoginAttemptMock.mockResolvedValue({ allowed: false, retryAfterSeconds: 900 });

    const result = await login(null, formDataWith("correct-password"));

    expect(result).toEqual({ error: "Demasiados intentos. Intente de nuevo más tarde." });
    expect(comparePasswordMock).not.toHaveBeenCalled();
    expect(openSessionMock).not.toHaveBeenCalled();
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
    openSessionMock.mockResolvedValue({ sessionId: "session-1" });

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

    expect(result).toEqual({ error: "El acceso no está disponible en este momento. Intente de nuevo en unos minutos." });
    expect(comparePasswordMock).not.toHaveBeenCalled();
    expect(openSessionMock).not.toHaveBeenCalled();
    expect(errorLog).toHaveBeenCalledWith(expect.stringContaining("login throttle"), expect.any(Error));
    errorLog.mockRestore();
  });

  it("ACTION-015: a throttle failure while clearing it after a good login does not block the login", async () => {
    comparePasswordMock.mockReturnValue(true);
    openSessionMock.mockResolvedValue({ sessionId: "session-1" });
    recordSuccessfulLoginMock.mockRejectedValue(new Error("connection refused"));
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(login(null, formDataWith("correct-password"))).rejects.toThrow("REDIRECT");

    expect(openSessionMock).toHaveBeenCalledTimes(1);
    errorLog.mockRestore();
  });

  it("BREAKGLASS-001: with the emergency login switched off (Google configured) it refuses before spending a throttle attempt", async () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "id");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "secret");
    vi.stubEnv("AUTH_URL", "https://admin.example.org");

    const result = await login(null, formDataWith("correct-password"));

    expect(result).toEqual({ error: "El acceso con contraseña no está habilitado. Use el acceso con Google." });
    expect(consumeLoginAttemptMock).not.toHaveBeenCalled();
    expect(comparePasswordMock).not.toHaveBeenCalled();
    expect(openSessionMock).not.toHaveBeenCalled();

    vi.stubEnv("BREAK_GLASS_PASSWORD_LOGIN", "1");
    comparePasswordMock.mockReturnValue(true);
    openSessionMock.mockResolvedValue({ sessionId: "session-1" });

    await expect(login(null, formDataWith("correct-password"))).rejects.toThrow("REDIRECT");
    vi.unstubAllEnvs();
  });

  it("BREAKGLASS-002: a successful emergency login is audited as break_glass, with the session id and no password", async () => {
    comparePasswordMock.mockReturnValue(true);
    openSessionMock.mockResolvedValue({ sessionId: "session-1" });

    await expect(login(null, formDataWith("correct-password"))).rejects.toThrow("REDIRECT");

    expect(testAuth.audit.entries).toEqual([
      expect.objectContaining({ actorKind: "break_glass", actorUserId: null, action: "login.success", entityType: "session", entityId: "session-1" }),
    ]);
    expect(JSON.stringify(testAuth.audit.entries)).not.toContain("correct-password");
  });

  it("BREAKGLASS-003: a wrong or empty password is audited as a system failure without what was typed", async () => {
    comparePasswordMock.mockReturnValue(false);

    await login(null, formDataWith("wrong-password"));
    await login(null, formDataWith(""));

    expect(testAuth.audit.entries.map((entry) => [entry.actorKind, entry.action, entry.entityId])).toEqual([
      ["system", "login.failure", null],
      ["system", "login.failure", null],
    ]);
    expect(JSON.stringify(testAuth.audit.entries)).not.toContain("wrong-password");
  });

  it("BREAKGLASS-004: a throttled attempt writes no audit entry (an attacker cannot flood the log)", async () => {
    consumeLoginAttemptMock.mockResolvedValue({ allowed: false, retryAfterSeconds: 30 });

    await login(null, formDataWith("anything"));

    expect(testAuth.audit.entries).toEqual([]);
  });

  it("BREAKGLASS-005: an audit failure does not fail a correct login", async () => {
    comparePasswordMock.mockReturnValue(true);
    openSessionMock.mockResolvedValue({ sessionId: "session-1" });
    testAuth.audit.failWith = new Error("db down");
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(login(null, formDataWith("correct-password"))).rejects.toThrow("REDIRECT");

    expect(redirectMock).toHaveBeenCalledWith("/admin");
    errorLog.mockRestore();
  });

  it("BREAKGLASS-006: a failure opening the session (database down) is a service-unavailable error, not a crash", async () => {
    comparePasswordMock.mockReturnValue(true);
    openSessionMock.mockRejectedValue(new Error("db down"));
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const result = await login(null, formDataWith("correct-password"));

    expect(result).toEqual({ error: "El acceso no está disponible en este momento. Intente de nuevo en unos minutos." });
    expect(testAuth.audit.entries).toEqual([]);
    expect(setKnownDeviceCookieMock).not.toHaveBeenCalled();
    errorLog.mockRestore();
  });

  describe("known-device throttle bucket", () => {
    beforeEach(() => {
      readKnownDeviceTokenMock.mockResolvedValue("device-cookie");
      verifyKnownDeviceMock.mockResolvedValue({ valid: true, deviceId: "dev-1" });
    });

    it("DEVICE-001: a valid device cookie is throttled by the device id, not by the IP", async () => {
      comparePasswordMock.mockReturnValue(false);

      await login(null, formDataWith("wrong-password"));

      expect(verifyKnownDeviceMock).toHaveBeenCalledWith("device-cookie");
      expect(consumeLoginAttemptMock).toHaveBeenCalledTimes(1);
      expect(consumeLoginAttemptMock).toHaveBeenCalledWith("device:dev-1");
    });

    it("DEVICE-002: a valid device cookie does not need a client IP, so nothing is reported as unknown", async () => {
      setHeaders({});
      comparePasswordMock.mockReturnValue(false);

      await login(null, formDataWith("wrong-password"));

      expect(consumeLoginAttemptMock).toHaveBeenCalledWith("device:dev-1");
      expect(reportUnknownLoginClientMock).not.toHaveBeenCalled();
    });

    it("DEVICE-003: a forged or expired device cookie falls back to the IP bucket", async () => {
      verifyKnownDeviceMock.mockResolvedValue({ valid: false });
      comparePasswordMock.mockReturnValue(false);

      await login(null, formDataWith("wrong-password"));

      expect(consumeLoginAttemptMock).toHaveBeenCalledWith("203.0.113.5");
    });

    it("DEVICE-004: no device cookie means the IP bucket and no verification", async () => {
      readKnownDeviceTokenMock.mockResolvedValue(undefined);
      comparePasswordMock.mockReturnValue(false);

      await login(null, formDataWith("wrong-password"));

      expect(verifyKnownDeviceMock).not.toHaveBeenCalled();
      expect(consumeLoginAttemptMock).toHaveBeenCalledWith("203.0.113.5");
    });

    it("DEVICE-005: the device bucket has its own backoff: a throttled device is refused even with the right password", async () => {
      consumeLoginAttemptMock.mockResolvedValue({ allowed: false, retryAfterSeconds: 30 });

      const result = await login(null, formDataWith("correct-password"));

      expect(result).toEqual({ error: "Demasiados intentos. Intente de nuevo más tarde." });
      expect(comparePasswordMock).not.toHaveBeenCalled();
      expect(setKnownDeviceCookieMock).not.toHaveBeenCalled();
    });

    it("DEVICE-006: a good login clears the bucket it spent (the device one) and renews the cookie with the same device id", async () => {
      comparePasswordMock.mockReturnValue(true);
      openSessionMock.mockResolvedValue({ sessionId: "session-1" });

      await expect(login(null, formDataWith("correct-password"))).rejects.toThrow("REDIRECT");

      expect(recordSuccessfulLoginMock).toHaveBeenCalledTimes(1);
      expect(recordSuccessfulLoginMock).toHaveBeenCalledWith("device:dev-1");
      expect(signKnownDeviceMock).toHaveBeenCalledWith("dev-1");
      expect(setKnownDeviceCookieMock).toHaveBeenCalledWith("device-token");
      expect(newDeviceIdMock).not.toHaveBeenCalled();
    });

    it("DEVICE-007: a good login without a device cookie mints a fresh device id and clears the IP bucket", async () => {
      readKnownDeviceTokenMock.mockResolvedValue(undefined);
      comparePasswordMock.mockReturnValue(true);
      openSessionMock.mockResolvedValue({ sessionId: "session-1" });

      await expect(login(null, formDataWith("correct-password"))).rejects.toThrow("REDIRECT");

      expect(recordSuccessfulLoginMock).toHaveBeenCalledWith("203.0.113.5");
      expect(signKnownDeviceMock).toHaveBeenCalledWith("fresh-device-id");
      expect(setKnownDeviceCookieMock).toHaveBeenCalledWith("device-token");
    });

    it("DEVICE-008: no device cookie is issued on a wrong password", async () => {
      comparePasswordMock.mockReturnValue(false);

      await login(null, formDataWith("wrong-password"));

      expect(signKnownDeviceMock).not.toHaveBeenCalled();
      expect(setKnownDeviceCookieMock).not.toHaveBeenCalled();
    });

    it("DEVICE-009: no device cookie is issued when the session cannot be signed", async () => {
      comparePasswordMock.mockReturnValue(true);
      openSessionMock.mockRejectedValue(new SessionSecretErrorMock("invalid secret"));

      await login(null, formDataWith("correct-password"));

      expect(setKnownDeviceCookieMock).not.toHaveBeenCalled();
    });

    it("DEVICE-010: failing to set the device cookie never blocks a correct login", async () => {
      comparePasswordMock.mockReturnValue(true);
      openSessionMock.mockResolvedValue({ sessionId: "session-1" });
      signKnownDeviceMock.mockRejectedValue(new Error("boom"));
      const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);

      await expect(login(null, formDataWith("correct-password"))).rejects.toThrow("REDIRECT");

      expect(openSessionMock).toHaveBeenCalledTimes(1);
      expect(redirectMock).toHaveBeenCalledWith("/admin");
      errorLog.mockRestore();
    });

    it("DEVICE-011: a throttle store failure still fails closed on the device bucket", async () => {
      consumeLoginAttemptMock.mockRejectedValue(new Error("connection refused"));
      const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);

      const result = await login(null, formDataWith("correct-password"));

      expect(result).toEqual({ error: "El acceso no está disponible en este momento. Intente de nuevo en unos minutos." });
      expect(comparePasswordMock).not.toHaveBeenCalled();
      errorLog.mockRestore();
    });
  });
});
