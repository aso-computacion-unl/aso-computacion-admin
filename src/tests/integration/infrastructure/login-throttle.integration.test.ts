import { beforeEach, describe, expect, it, vi } from "vitest";

const { redirectMock, cookieSetMock, cookieJar, headersGetMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
  cookieSetMock: vi.fn(),
  // What the browser would send back on the next request.
  cookieJar: new Map<string, string>(),
  headersGetMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => ({ get: headersGetMock })),
  cookies: vi.fn(async () => ({
    set: (name: string, value: string, options: unknown) => {
      cookieSetMock(name, value, options);
      cookieJar.set(name, value);
    },
    get: (name: string) => (cookieJar.has(name) ? { name, value: cookieJar.get(name) } : undefined),
  })),
}));

import { KNOWN_DEVICE_COOKIE_NAME, deviceThrottleKey, signKnownDevice, verifyKnownDevice } from "@/infrastructure/auth/known-device";
import { AUTH_COOKIE_NAME } from "@/infrastructure/auth/session-jwt";
import { prisma } from "@/infrastructure/prisma/client";

// A fresh action module per test: the ADMIN_PASSWORD "reported once" latch lives in the module graph.
// (The Prisma client is a process-wide singleton, so re-importing does not open new connections.)
let login: typeof import("@/interface/auth/actions").login;

const PASSWORD = "correct horse battery staple";
const THROTTLED = { error: "Demasiados intentos. Intente de nuevo más tarde." };

function form(password: string): FormData {
  const data = new FormData();
  data.set("password", password);
  return data;
}

function fromIp(ip: string | null) {
  headersGetMock.mockImplementation((name: string) => (name === "x-real-ip" ? ip : null));
}

// The real login action against the real Postgres throttle: only next/* is stubbed.
describe("login action with the Postgres throttle", () => {
  beforeEach(async () => {
    vi.resetModules();
    ({ login } = await import("@/interface/auth/actions"));
    vi.clearAllMocks();
    cookieJar.clear();
    vi.stubEnv("ADMIN_PASSWORD", PASSWORD);
    vi.stubEnv("ADMIN_SECRET", "z".repeat(32));
  });

  it("the correct password still works from another IP after one IP hit the limit (campus NAT)", async () => {
    fromIp("203.0.113.7");
    for (let i = 0; i < 12; i += 1) await login(null, form("wrong"));

    // The abusive IP is slowed down, even with the right password...
    await expect(login(null, form(PASSWORD))).resolves.toEqual(THROTTLED);
    expect(cookieSetMock).not.toHaveBeenCalled();

    // ...but the admin on another network is not.
    fromIp("198.51.100.9");
    await expect(login(null, form(PASSWORD))).rejects.toThrow("REDIRECT:/admin");
    expect(cookieSetMock.mock.calls.filter(([name]) => name === AUTH_COOKIE_NAME)).toHaveLength(1);
  });

  it("a mistyped password under the free attempts does not slow the next correct one, and success clears the count", async () => {
    fromIp("203.0.113.7");
    for (let i = 0; i < 4; i += 1) await expect(login(null, form("wrong"))).resolves.toEqual({ error: "Contraseña incorrecta.", field: "password" });

    await expect(login(null, form(PASSWORD))).rejects.toThrow("REDIRECT:/admin");

    // Cleared: four more mistakes are free again, so the correct one still works.
    for (let i = 0; i < 4; i += 1) await login(null, form("wrong"));
    await expect(login(null, form(PASSWORD))).rejects.toThrow("REDIRECT:/admin");
  });

  it("parallel guesses cannot beat the limit: at most the free attempts reach the password check", async () => {
    fromIp("203.0.113.7");

    const results = await Promise.all(Array.from({ length: 30 }, () => login(null, form("wrong"))));

    expect(results.filter((result) => result.error === "Contraseña incorrecta.")).toHaveLength(5);
    expect(results.filter((result) => result.error === THROTTLED.error)).toHaveLength(25);
  });

  it("requests without any client IP share one 'unknown' bucket that is still throttled", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    fromIp(null);
    for (let i = 0; i < 5; i += 1) await login(null, form("wrong"));

    await expect(login(null, form(PASSWORD))).resolves.toEqual(THROTTLED);
    fromIp("198.51.100.9");
    await expect(login(null, form(PASSWORD))).rejects.toThrow("REDIRECT:/admin");
  });

  it("a missing ADMIN_PASSWORD logs a clear error and fails closed", async () => {
    vi.stubEnv("ADMIN_PASSWORD", "");
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
    fromIp("203.0.113.7");

    await expect(login(null, form("anything"))).resolves.toEqual({ error: "El acceso no está disponible en este momento. Intente de nuevo en unos minutos." });

    expect(errorLog).toHaveBeenCalledWith(expect.stringMatching(/ADMIN_PASSWORD.*(not set|missing|configure)/i));
    expect(cookieSetMock).not.toHaveBeenCalled();
  });

  it("the ADMIN_PASSWORD misconfiguration is logged once per process, not once per attempt", async () => {
    vi.stubEnv("ADMIN_PASSWORD", "");
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
    fromIp("203.0.113.7");

    for (let i = 0; i < 4; i += 1) {
      await expect(login(null, form("anything"))).resolves.toEqual({ error: "El acceso no está disponible en este momento. Intente de nuevo en unos minutos." });
    }

    expect(errorLog.mock.calls.filter(([message]) => /ADMIN_PASSWORD/.test(String(message)))).toHaveLength(1);
  });

  it("a too-short ADMIN_PASSWORD fails closed like a missing one, logging why and spending no attempt", async () => {
    vi.stubEnv("ADMIN_PASSWORD", "fifteen-chars!!");
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
    fromIp("203.0.113.7");

    await expect(login(null, form("fifteen-chars!!"))).resolves.toEqual({
      error: "El acceso no está disponible en este momento. Intente de nuevo en unos minutos.",
    });

    expect(errorLog).toHaveBeenCalledWith(expect.stringMatching(/ADMIN_PASSWORD.*16/));
    expect(cookieSetMock).not.toHaveBeenCalled();
    expect(await prisma.loginAttempt.count()).toBe(0);
  });

  it("keys IPv6 clients by their /64: rotating the host part does not buy fresh attempts", async () => {
    for (let i = 0; i < 5; i += 1) {
      fromIp(`2001:db8:1:2::${i + 1}`);
      await expect(login(null, form("wrong"))).resolves.toEqual({ error: "Contraseña incorrecta.", field: "password" });
    }

    fromIp("2001:db8:1:2:ffff:ffff:ffff:ffff");
    await expect(login(null, form(PASSWORD))).resolves.toEqual(THROTTLED);

    // A neighbouring /64 is a different client.
    fromIp("2001:db8:1:3::1");
    await expect(login(null, form(PASSWORD))).rejects.toThrow("REDIRECT:/admin");
    expect(await prisma.loginAttempt.findUnique({ where: { key: "2001:db8:1:2::/64" } })).toMatchObject({ attempts: 5 });
  });

  describe("known-device cookie (an attacker on the admin's own NAT)", () => {
    const NAT = "203.0.113.7";

    async function adminLogsInOnce(): Promise<string> {
      fromIp(NAT);
      await expect(login(null, form(PASSWORD))).rejects.toThrow("REDIRECT:/admin");
      const device = cookieJar.get(KNOWN_DEVICE_COOKIE_NAME);
      expect(device).toBeDefined();
      cookieJar.clear();

      return device!;
    }

    async function attackerReachesTheCap(): Promise<void> {
      fromIp(NAT);
      for (let i = 0; i < 12; i += 1) await login(null, form("wrong"));
    }

    it("a successful login sets a signed, httpOnly, secure, sameSite=strict, long-lived device cookie that is not a session", async () => {
      fromIp(NAT);
      await expect(login(null, form(PASSWORD))).rejects.toThrow("REDIRECT:/admin");

      const call = cookieSetMock.mock.calls.find(([name]) => name === KNOWN_DEVICE_COOKIE_NAME);
      expect(call).toBeDefined();
      const [, value, options] = call as [string, string, Record<string, unknown>];
      expect(options).toMatchObject({ httpOnly: true, secure: true, sameSite: "strict", path: "/" });
      expect(options.maxAge).toBeGreaterThanOrEqual(30 * 86400);
      expect(await verifyKnownDevice(value)).toMatchObject({ valid: true });
      expect(value).not.toBe(cookieJar.get(AUTH_COOKIE_NAME));
    });

    it("a wrong password issues no device cookie", async () => {
      fromIp(NAT);
      await login(null, form("wrong"));

      expect(cookieSetMock).not.toHaveBeenCalled();
    });

    it("the admin with the device cookie still logs in while an attacker holds the IP at the cap; without it they are throttled", async () => {
      const device = await adminLogsInOnce();
      await attackerReachesTheCap();

      // No cookie: same IP, same throttle as the attacker.
      await expect(login(null, form(PASSWORD))).resolves.toEqual(THROTTLED);

      // With the cookie: own bucket, so the attacker's backoff does not apply.
      cookieJar.set(KNOWN_DEVICE_COOKIE_NAME, device);
      await expect(login(null, form(PASSWORD))).rejects.toThrow("REDIRECT:/admin");

      // The attacker is still throttled afterwards: the admin's success did not reset the IP bucket.
      cookieJar.clear();
      await expect(login(null, form(PASSWORD))).resolves.toEqual(THROTTLED);
      expect((await prisma.loginAttempt.findUnique({ where: { key: NAT } }))?.attempts).toBeGreaterThanOrEqual(5);
    });

    it("rotating ADMIN_PASSWORD makes the old device cookie fall back to the IP bucket", async () => {
      const device = await adminLogsInOnce();
      const { deviceId } = (await verifyKnownDevice(device)) as { valid: true; deviceId: string };
      const NEW_PASSWORD = "a rotated admin password";
      vi.stubEnv("ADMIN_PASSWORD", NEW_PASSWORD);
      await attackerReachesTheCap();

      // The cookie minted under the old password is ignored: same IP bucket as the attacker.
      cookieJar.clear();
      cookieJar.set(KNOWN_DEVICE_COOKIE_NAME, device);
      await expect(login(null, form(NEW_PASSWORD))).resolves.toEqual(THROTTLED);
      expect(await prisma.loginAttempt.findUnique({ where: { key: deviceThrottleKey(deviceId) } })).toBeNull();

      // A cookie issued under the new password gets its own bucket again (the issuing login came from another IP).
      fromIp("198.51.100.20");
      cookieJar.clear();
      await expect(login(null, form(NEW_PASSWORD))).rejects.toThrow("REDIRECT:/admin");
      const renewed = cookieJar.get(KNOWN_DEVICE_COOKIE_NAME)!;
      fromIp(NAT);
      cookieJar.clear();
      cookieJar.set(KNOWN_DEVICE_COOKIE_NAME, renewed);
      await expect(login(null, form(NEW_PASSWORD))).rejects.toThrow("REDIRECT:/admin");
    });

    it("keeps the same device id across logins, so the device bucket is stable", async () => {
      const first = await adminLogsInOnce();
      cookieJar.set(KNOWN_DEVICE_COOKIE_NAME, first);
      await expect(login(null, form(PASSWORD))).rejects.toThrow("REDIRECT:/admin");

      const second = cookieJar.get(KNOWN_DEVICE_COOKIE_NAME)!;
      const [a, b] = await Promise.all([verifyKnownDevice(first), verifyKnownDevice(second)]);
      expect(a).toMatchObject({ valid: true });
      expect(b).toEqual(a);
    });

    it("a forged, expired or garbage device cookie falls back to the IP bucket", async () => {
      await attackerReachesTheCap();
      cookieJar.clear();

      vi.stubEnv("ADMIN_SECRET", "y".repeat(32));
      const forged = await signKnownDevice("forged-device");
      vi.stubEnv("ADMIN_SECRET", "z".repeat(32));
      const expired = await signKnownDevice("expired-device", Math.floor(Date.now() / 1000) - 400 * 86400);

      for (const value of [forged, expired, "garbage", AUTH_COOKIE_NAME]) {
        cookieJar.clear();
        cookieJar.set(KNOWN_DEVICE_COOKIE_NAME, value);
        await expect(login(null, form(PASSWORD))).resolves.toEqual(THROTTLED);
      }

      // Nothing was spent on a device bucket for any of them.
      expect(await prisma.loginAttempt.findMany({ where: { key: { startsWith: "device:" } } })).toEqual([]);
    });

    it("a session cookie sent as the device cookie is no device", async () => {
      fromIp(NAT);
      await expect(login(null, form(PASSWORD))).rejects.toThrow("REDIRECT:/admin");
      const session = cookieJar.get(AUTH_COOKIE_NAME)!;
      cookieJar.clear();
      await attackerReachesTheCap();

      cookieJar.clear();
      cookieJar.set(KNOWN_DEVICE_COOKIE_NAME, session);
      await expect(login(null, form(PASSWORD))).resolves.toEqual(THROTTLED);
    });

    it("the device bucket has its own backoff: a stolen cookie is not an unlimited oracle", async () => {
      const device = await adminLogsInOnce();
      const { deviceId } = (await verifyKnownDevice(device)) as { valid: true; deviceId: string };
      fromIp("198.51.100.77");

      cookieJar.set(KNOWN_DEVICE_COOKIE_NAME, device);
      for (let i = 0; i < 12; i += 1) await login(null, form("wrong"));
      await expect(login(null, form(PASSWORD))).resolves.toEqual(THROTTLED);

      expect(await prisma.loginAttempt.findUnique({ where: { key: deviceThrottleKey(deviceId) } })).toMatchObject({ attempts: 5 });
      // Spent on the device bucket only: the IP it came from is untouched.
      expect(await prisma.loginAttempt.findUnique({ where: { key: "198.51.100.77" } })).toBeNull();
    });

    it("parallel guesses with a device cookie cannot beat the device limit either", async () => {
      const device = await adminLogsInOnce();
      cookieJar.set(KNOWN_DEVICE_COOKIE_NAME, device);

      const results = await Promise.all(Array.from({ length: 30 }, () => login(null, form("wrong"))));

      expect(results.filter((result) => result.error === "Contraseña incorrecta.")).toHaveLength(5);
      expect(results.filter((result) => result.error === THROTTLED.error)).toHaveLength(25);
    });

    it("a good login with the cookie clears the device bucket only", async () => {
      const device = await adminLogsInOnce();
      const { deviceId } = (await verifyKnownDevice(device)) as { valid: true; deviceId: string };
      await attackerReachesTheCap();

      cookieJar.clear();
      cookieJar.set(KNOWN_DEVICE_COOKIE_NAME, device);
      for (let i = 0; i < 3; i += 1) await login(null, form("typo"));
      expect((await prisma.loginAttempt.findUnique({ where: { key: deviceThrottleKey(deviceId) } }))?.attempts).toBe(3);

      cookieJar.set(KNOWN_DEVICE_COOKIE_NAME, device);
      await expect(login(null, form(PASSWORD))).rejects.toThrow("REDIRECT:/admin");

      expect(await prisma.loginAttempt.findUnique({ where: { key: deviceThrottleKey(deviceId) } })).toBeNull();
      expect(await prisma.loginAttempt.findUnique({ where: { key: NAT } })).not.toBeNull();
      expect(cookieJar.has(KNOWN_DEVICE_COOKIE_NAME)).toBe(true);
    });
  });
});
