import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookiesMock, getFaqUseCasesMock, revalidatePathMock, redirectMock, useCases } = vi.hoisted(() => {
  const execute = () => vi.fn(async () => ({ id: "faq-1" }));
  const useCases = {
    create: { execute: execute() },
    update: { execute: execute() },
    setPublished: { execute: execute() },
    trash: { execute: execute() },
    move: { execute: execute() },
  };

  return {
    cookiesMock: vi.fn(),
    getFaqUseCasesMock: vi.fn(() => useCases),
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
vi.mock("@/interface/admin/faqs/faqs-container", () => ({ getFaqUseCases: getFaqUseCasesMock }));

import { AUTH_COOKIE_NAME } from "@/infrastructure/auth/session-jwt";
import { signInAs } from "@/tests/support/test-auth";
import * as actions from "@/interface/admin/faqs/actions";
import { registerPolicyCases } from "@/tests/support/action-policy";
import { expectGuardFirstInEveryAction } from "@/tests/support/guard-first";

const SESSION_EXPIRED = { error: "Su sesión expiró. Inicie sesión de nuevo." };

function faqForm(): FormData {
  const form = new FormData();
  form.set("question", "¿Cuesta?");
  form.set("answer", "No.");
  return form;
}

// One entry per exported action: the test below fails when an action is added without a case here.
const ACTION_CALLS: Record<string, () => Promise<unknown>> = {
  createFaq: () => actions.createFaq(null, faqForm()),
  updateFaq: () => actions.updateFaq("faq-1", null, faqForm()),
  setFaqPublished: () => actions.setFaqPublished("faq-1", true),
  trashFaq: () => actions.trashFaq("faq-1"),
  moveFaq: () => actions.moveFaq("faq-1", "up"),
};

function cookieJar(value: string | undefined) {
  cookiesMock.mockResolvedValue({
    get: (name: string) => (name === AUTH_COOKIE_NAME && value !== undefined ? { name, value } : undefined),
  });
}

describe("faq server actions require an admin session (L9)", () => {
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
      expect(getFaqUseCasesMock).not.toHaveBeenCalled();
      for (const useCase of Object.values(useCases)) {
        expect(useCase.execute).not.toHaveBeenCalled();
      }
      expect(revalidatePathMock).not.toHaveBeenCalled();
      expect(redirectMock).not.toHaveBeenCalled();
    });
  });

  it("positive control: a valid session reaches the use cases", async () => {
    cookieJar(await signInAs("ADMIN"));

    await expect(actions.trashFaq("faq-1")).resolves.toEqual({ success: true });

    expect(useCases.trash.execute).toHaveBeenCalledWith({ id: "faq-1" });
  });

  it("the guard is the first statement of every action", () => {
    expect(expectGuardFirstInEveryAction("src/interface/admin/faqs/actions.ts").sort()).toEqual(Object.keys(ACTION_CALLS).sort());
  });

  describe("role matrix and audit", () => {
    registerPolicyCases({
      actionsPath: "src/interface/admin/faqs/actions.ts",
      actionCalls: ACTION_CALLS,
      cookiesMock,
      untouchedMocks: [getFaqUseCasesMock, revalidatePathMock, redirectMock],
    });
  });
});
