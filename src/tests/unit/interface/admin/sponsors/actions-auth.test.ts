import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookiesMock, getSponsorUseCasesMock, revalidatePathMock, redirectMock, useCases } = vi.hoisted(() => {
  const execute = () => vi.fn(async () => ({ id: "sponsor-1" }));
  const useCases = {
    create: { execute: execute() },
    update: { execute: execute() },
    setPublished: { execute: execute() },
    trash: { execute: execute() },
    move: { execute: execute() },
    setLogo: { execute: execute() },
    removeLogo: { execute: execute() },
  };

  return {
    cookiesMock: vi.fn(),
    getSponsorUseCasesMock: vi.fn(() => useCases),
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
vi.mock("@/interface/admin/sponsors/sponsors-container", () => ({ getSponsorUseCases: getSponsorUseCasesMock }));

import { AUTH_COOKIE_NAME } from "@/infrastructure/auth/session-jwt";
import { signInAs } from "@/tests/support/test-auth";
import * as actions from "@/interface/admin/sponsors/actions";
import { registerPolicyCases } from "@/tests/support/action-policy";
import { expectGuardFirstInEveryAction } from "@/tests/support/guard-first";

const SESSION_EXPIRED = { error: "Su sesión expiró. Inicie sesión de nuevo." };

function sponsorForm(): FormData {
  const form = new FormData();
  form.set("name", "Acme");
  form.set("url", "https://acme.test");
  return form;
}

function imageForm(): FormData {
  const form = new FormData();
  form.set("file", new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], "a.jpg", { type: "image/jpeg" }));
  form.set("logoAlt", "Charla");
  return form;
}

// One entry per exported action: the test below fails when an action is added without a case here.
const ACTION_CALLS: Record<string, () => Promise<unknown>> = {
  createSponsor: () => actions.createSponsor(null, sponsorForm()),
  updateSponsor: () => actions.updateSponsor("sponsor-1", null, sponsorForm()),
  setSponsorPublished: () => actions.setSponsorPublished("sponsor-1", true),
  trashSponsor: () => actions.trashSponsor("sponsor-1"),
  moveSponsor: () => actions.moveSponsor("sponsor-1", "up"),
  uploadSponsorLogo: () => actions.uploadSponsorLogo("sponsor-1", null, imageForm()),
  removeSponsorLogo: () => actions.removeSponsorLogo("sponsor-1"),
};

function cookieJar(value: string | undefined) {
  cookiesMock.mockResolvedValue({
    get: (name: string) => (name === AUTH_COOKIE_NAME && value !== undefined ? { name, value } : undefined),
  });
}

describe("sponsor server actions require an admin session (L9)", () => {
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
      expect(getSponsorUseCasesMock).not.toHaveBeenCalled();
      for (const useCase of Object.values(useCases)) {
        expect(useCase.execute).not.toHaveBeenCalled();
      }
      expect(revalidatePathMock).not.toHaveBeenCalled();
      expect(redirectMock).not.toHaveBeenCalled();
    });
  });

  it("positive control: a valid session reaches the use cases", async () => {
    cookieJar(await signInAs("ADMIN"));

    await expect(actions.trashSponsor("sponsor-1")).resolves.toEqual({ success: true });

    expect(useCases.trash.execute).toHaveBeenCalledWith({ id: "sponsor-1" });
  });

  it("the guard is the first statement of every action", () => {
    expect(expectGuardFirstInEveryAction("src/interface/admin/sponsors/actions.ts").sort()).toEqual(Object.keys(ACTION_CALLS).sort());
  });

  describe("role matrix and audit", () => {
    registerPolicyCases({
      actionsPath: "src/interface/admin/sponsors/actions.ts",
      actionCalls: ACTION_CALLS,
      cookiesMock,
      untouchedMocks: [getSponsorUseCasesMock, revalidatePathMock, redirectMock],
    });
  });
});
