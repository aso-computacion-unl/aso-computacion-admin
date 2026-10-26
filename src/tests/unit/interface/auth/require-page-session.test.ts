import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { cookiesMock, redirectMock } = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
  redirectMock: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

vi.mock("next/headers", () => ({ cookies: cookiesMock }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));

import { AUTH_COOKIE_NAME } from "@/infrastructure/auth/session-jwt";
import { RESTRICTED_REDIRECT, requirePageSession } from "@/interface/auth/require-page-session";
import { signInAs } from "@/tests/support/test-auth";

function withCookie(value: string | undefined) {
  cookiesMock.mockResolvedValue({ get: (name: string) => (name === AUTH_COOKIE_NAME && value !== undefined ? { name, value } : undefined) });
}

describe("requirePageSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("ADMIN_SECRET", "test-secret-test-secret-test-secret-1234");
  });

  afterEach(() => vi.unstubAllEnvs());

  it("returns the actor for an editor-level page and for an admin-only page when the user is an admin", async () => {
    withCookie(await signInAs("EDITOR"));
    await expect(requirePageSession()).resolves.toMatchObject({ role: "EDITOR" });

    withCookie(await signInAs("ADMIN"));
    await expect(requirePageSession("ADMIN")).resolves.toMatchObject({ role: "ADMIN" });
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("sends a visitor without a valid session to the login", async () => {
    withCookie(undefined);
    await expect(requirePageSession()).rejects.toThrow("REDIRECT:/login");

    withCookie("forged.token.value");
    await expect(requirePageSession("ADMIN")).rejects.toThrow("REDIRECT:/login");
  });

  it("sends an editor who opens an admin-only page to the admin home", async () => {
    withCookie(await signInAs("EDITOR"));

    await expect(requirePageSession("ADMIN")).rejects.toThrow(`REDIRECT:${RESTRICTED_REDIRECT}`);
  });
});
