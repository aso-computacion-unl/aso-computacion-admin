import { SignJWT } from "jose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { cookiesMock } = vi.hoisted(() => ({ cookiesMock: vi.fn() }));

vi.mock("next/headers", () => ({ cookies: cookiesMock }));

import { AUTH_COOKIE_NAME, signSession } from "@/infrastructure/auth/session-jwt";
import { UnauthorizedError, requireAdminSession } from "@/interface/auth/require-admin-session";

const SECRET = "test-secret-test-secret-test-secret-1234";

function withCookie(value: string | undefined): void {
  cookiesMock.mockResolvedValue({
    get: (name: string) => (name === AUTH_COOKIE_NAME && value !== undefined ? { name, value } : undefined),
  });
}

function signWith(secret: string, claims: { sub?: string; exp?: number } = {}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  return new SignJWT({ sub: claims.sub ?? "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now - 100)
    .setExpirationTime(claims.exp ?? now + 3600)
    .sign(new TextEncoder().encode(secret));
}

describe("requireAdminSession", () => {
  beforeEach(() => {
    vi.stubEnv("ADMIN_SECRET", SECRET);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    cookiesMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("resolves for a valid session cookie", async () => {
    withCookie(await signSession());

    await expect(requireAdminSession()).resolves.toBeUndefined();
  });

  it.each([
    ["no cookie", undefined],
    ["an empty cookie", ""],
    ["a malformed token", "not-a-jwt"],
  ])("rejects with %s", async (_label, value) => {
    withCookie(value);

    await expect(requireAdminSession()).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("rejects a token signed with another secret", async () => {
    withCookie(await signWith("another-secret-another-secret-1234567"));

    await expect(requireAdminSession()).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("rejects an expired token", async () => {
    withCookie(await signWith(SECRET, { exp: Math.floor(Date.now() / 1000) - 3600 }));

    await expect(requireAdminSession()).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("rejects a token whose subject is not the admin", async () => {
    withCookie(await signWith(SECRET, { sub: "someone-else" }));

    await expect(requireAdminSession()).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("fails closed when the signing secret is missing or too short", async () => {
    withCookie(await signSession());

    vi.stubEnv("ADMIN_SECRET", "");
    await expect(requireAdminSession()).rejects.toBeInstanceOf(UnauthorizedError);

    vi.stubEnv("ADMIN_SECRET", "short");
    await expect(requireAdminSession()).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("fails closed when the cookie store itself throws", async () => {
    cookiesMock.mockRejectedValue(new Error("no request scope"));

    await expect(requireAdminSession()).rejects.toBeInstanceOf(UnauthorizedError);
  });
});
