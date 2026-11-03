import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookiesMock, getTestimonialUseCasesMock, revalidatePathMock, redirectMock, useCases } = vi.hoisted(() => {
  const execute = () => vi.fn(async () => ({ id: "testimonial-1" }));
  const useCases = {
    create: { execute: execute() },
    update: { execute: execute() },
    setPublished: { execute: execute() },
    trash: { execute: execute() },
    move: { execute: execute() },
    setPhoto: { execute: execute() },
    removePhoto: { execute: execute() },
  };

  return {
    cookiesMock: vi.fn(),
    getTestimonialUseCasesMock: vi.fn(() => useCases),
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
vi.mock("@/interface/admin/testimonials/testimonials-container", () => ({ getTestimonialUseCases: getTestimonialUseCasesMock }));

import { AUTH_COOKIE_NAME } from "@/infrastructure/auth/session-jwt";
import { signInAs } from "@/tests/support/test-auth";
import * as actions from "@/interface/admin/testimonials/actions";
import { registerPolicyCases } from "@/tests/support/action-policy";
import { expectGuardFirstInEveryAction } from "@/tests/support/guard-first";

const SESSION_EXPIRED = { error: "Su sesión expiró. Inicie sesión de nuevo." };

function testimonialForm(): FormData {
  const form = new FormData();
  form.set("quote", "Muy útil.");
  form.set("name", "Ana Pérez");
  form.set("role", "Egresada");
  return form;
}

function imageForm(): FormData {
  const form = new FormData();
  form.set("file", new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], "a.jpg", { type: "image/jpeg" }));
  form.set("photoAlt", "Charla");
  return form;
}

// One entry per exported action: the test below fails when an action is added without a case here.
const ACTION_CALLS: Record<string, () => Promise<unknown>> = {
  createTestimonial: () => actions.createTestimonial(null, testimonialForm()),
  updateTestimonial: () => actions.updateTestimonial("testimonial-1", null, testimonialForm()),
  setTestimonialPublished: () => actions.setTestimonialPublished("testimonial-1", true),
  trashTestimonial: () => actions.trashTestimonial("testimonial-1"),
  moveTestimonial: () => actions.moveTestimonial("testimonial-1", "up"),
  uploadTestimonialPhoto: () => actions.uploadTestimonialPhoto("testimonial-1", null, imageForm()),
  removeTestimonialPhoto: () => actions.removeTestimonialPhoto("testimonial-1"),
};

function cookieJar(value: string | undefined) {
  cookiesMock.mockResolvedValue({
    get: (name: string) => (name === AUTH_COOKIE_NAME && value !== undefined ? { name, value } : undefined),
  });
}

describe("testimonial server actions require an admin session (L9)", () => {
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
      expect(getTestimonialUseCasesMock).not.toHaveBeenCalled();
      for (const useCase of Object.values(useCases)) {
        expect(useCase.execute).not.toHaveBeenCalled();
      }
      expect(revalidatePathMock).not.toHaveBeenCalled();
      expect(redirectMock).not.toHaveBeenCalled();
    });
  });

  it("positive control: a valid session reaches the use cases", async () => {
    cookieJar(await signInAs("ADMIN"));

    await expect(actions.trashTestimonial("testimonial-1")).resolves.toEqual({ success: true });

    expect(useCases.trash.execute).toHaveBeenCalledWith({ id: "testimonial-1" });
  });

  it("the guard is the first statement of every action", () => {
    expect(expectGuardFirstInEveryAction("src/interface/admin/testimonials/actions.ts").sort()).toEqual(Object.keys(ACTION_CALLS).sort());
  });

  describe("role matrix and audit", () => {
    registerPolicyCases({
      actionsPath: "src/interface/admin/testimonials/actions.ts",
      actionCalls: ACTION_CALLS,
      cookiesMock,
      untouchedMocks: [getTestimonialUseCasesMock, revalidatePathMock, redirectMock],
    });
  });
});
