import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookiesMock, getSiteSettingsUseCasesMock, revalidatePathMock, redirectMock, useCases } = vi.hoisted(() => {
  const useCases = { update: { execute: vi.fn(async () => ({ tagline: "x" })) } };

  return {
    cookiesMock: vi.fn(),
    getSiteSettingsUseCasesMock: vi.fn(() => useCases),
    revalidatePathMock: vi.fn(),
    redirectMock: vi.fn(() => {
      throw new Error("REDIRECT");
    }),
    useCases,
  };
});

vi.mock("next/headers", () => ({ cookies: cookiesMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("@/interface/admin/settings/settings-container", () => ({ getSiteSettingsUseCases: getSiteSettingsUseCasesMock }));

import { AUTH_COOKIE_NAME } from "@/infrastructure/auth/session-jwt";
import { signInAs } from "@/tests/support/test-auth";
import * as actions from "@/interface/admin/settings/actions";
import { expectGuardFirstInEveryAction } from "@/tests/support/guard-first";

const SESSION_EXPIRED = { error: "Su sesión expiró. Inicie sesión de nuevo." };

function settingsForm(): FormData {
  const form = new FormData();
  form.set("tagline", "Lema");
  form.set("description", "Descripción");
  form.set("about", "Acerca");
  return form;
}

// One entry per exported action: the test below fails when an action is added without a case here.
const ACTION_CALLS: Record<string, () => Promise<unknown>> = {
  updateSiteSettings: () => actions.updateSiteSettings(null, settingsForm()),
};

function cookieJar(value: string | undefined) {
  cookiesMock.mockResolvedValue({
    get: (name: string) => (name === AUTH_COOKIE_NAME && value !== undefined ? { name, value } : undefined),
  });
}

describe("site settings server actions require an admin session (L9)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("ADMIN_SECRET", "test-secret-test-secret-test-secret-1234");
  });

  it("has an auth case for every exported action", () => {
    expect(Object.keys(ACTION_CALLS).sort()).toEqual(Object.keys(actions).sort());
  });

  describe.each([
    ["no cookie", undefined],
    ["a forged token", "forged.token.value"],
  ])("with %s", (_label, cookie) => {
    beforeEach(() => cookieJar(cookie));

    it.each(Object.entries(ACTION_CALLS))("%s rejects and performs no write", async (_name, call) => {
      expect(await call()).toEqual(SESSION_EXPIRED);
      expect(getSiteSettingsUseCasesMock).not.toHaveBeenCalled();
      expect(useCases.update.execute).not.toHaveBeenCalled();
      expect(revalidatePathMock).not.toHaveBeenCalled();
      expect(redirectMock).not.toHaveBeenCalled();
    });
  });

  it("positive control: a valid session reaches the use case", async () => {
    cookieJar(await signInAs("ADMIN"));

    await expect(actions.updateSiteSettings(null, settingsForm())).resolves.toEqual({ success: true });

    expect(useCases.update.execute).toHaveBeenCalledWith({ tagline: "Lema", description: "Descripción", about: "Acerca" });
  });

  it("the guard is the first statement of every action", () => {
    expect(expectGuardFirstInEveryAction("src/interface/admin/settings/actions.ts").sort()).toEqual(Object.keys(ACTION_CALLS).sort());
  });
});
