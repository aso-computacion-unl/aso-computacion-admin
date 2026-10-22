import { beforeEach, describe, expect, it, vi } from "vitest";

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
  cookies: vi.fn(async () => ({ set: cookieSetMock })),
}));

import { login } from "@/interface/auth/actions";

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
  beforeEach(() => {
    vi.clearAllMocks();
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
    expect(cookieSetMock).toHaveBeenCalledTimes(1);
  });

  it("a mistyped password under the free attempts does not slow the next correct one, and success clears the count", async () => {
    fromIp("203.0.113.7");
    for (let i = 0; i < 4; i += 1) await expect(login(null, form("wrong"))).resolves.toEqual({ error: "Contraseña incorrecta." });

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

    await expect(login(null, form("anything"))).resolves.toEqual({ error: "Authentication service is temporarily unavailable." });

    expect(errorLog).toHaveBeenCalledWith(expect.stringMatching(/ADMIN_PASSWORD.*(not set|missing|configure)/i));
    expect(cookieSetMock).not.toHaveBeenCalled();
  });
});
