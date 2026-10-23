import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookiesMock, getPillarUseCasesMock, revalidatePathMock, redirectMock, useCases } = vi.hoisted(() => {
  const execute = () => vi.fn(async () => ({ id: "pillar-1" }));
  const useCases = {
    create: { execute: execute() },
    update: { execute: execute() },
    setPublished: { execute: execute() },
    delete: { execute: execute() },
    move: { execute: execute() },
    setImage: { execute: execute() },
    removeImage: { execute: execute() },
  };

  return {
    cookiesMock: vi.fn(),
    getPillarUseCasesMock: vi.fn(() => useCases),
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
vi.mock("@/interface/admin/pillars/pillars-container", () => ({ getPillarUseCases: getPillarUseCasesMock }));

import { AUTH_COOKIE_NAME, signSession } from "@/infrastructure/auth/session-jwt";
import * as actions from "@/interface/admin/pillars/actions";
import { expectGuardFirstInEveryAction } from "@/tests/support/guard-first";

const SESSION_EXPIRED = { error: "Su sesión expiró. Inicie sesión de nuevo." };

function pillarForm(): FormData {
  const form = new FormData();
  form.set("word", "VOZ");
  form.set("title", "Representamos");
  form.set("text", "Texto");
  return form;
}

function imageForm(): FormData {
  const form = new FormData();
  form.set("file", new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], "a.jpg", { type: "image/jpeg" }));
  form.set("imageAlt", "Charla");
  return form;
}

// One entry per exported action: the test below fails when an action is added without a case here.
const ACTION_CALLS: Record<string, () => Promise<unknown>> = {
  createPillar: () => actions.createPillar(null, pillarForm()),
  updatePillar: () => actions.updatePillar("pillar-1", null, pillarForm()),
  setPillarPublished: () => actions.setPillarPublished("pillar-1", true),
  deletePillar: () => actions.deletePillar("pillar-1"),
  movePillar: () => actions.movePillar("pillar-1", "up"),
  uploadPillarImage: () => actions.uploadPillarImage("pillar-1", null, imageForm()),
  removePillarImage: () => actions.removePillarImage("pillar-1"),
};

function cookieJar(value: string | undefined) {
  cookiesMock.mockResolvedValue({
    get: (name: string) => (name === AUTH_COOKIE_NAME && value !== undefined ? { name, value } : undefined),
  });
}

describe("pillar server actions require an admin session (L9)", () => {
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
      expect(getPillarUseCasesMock).not.toHaveBeenCalled();
      for (const useCase of Object.values(useCases)) {
        expect(useCase.execute).not.toHaveBeenCalled();
      }
      expect(revalidatePathMock).not.toHaveBeenCalled();
      expect(redirectMock).not.toHaveBeenCalled();
    });
  });

  it("positive control: a valid session reaches the use cases", async () => {
    cookieJar(await signSession());

    await expect(actions.deletePillar("pillar-1")).resolves.toEqual({ success: true });

    expect(useCases.delete.execute).toHaveBeenCalledWith({ id: "pillar-1" });
  });

  it("the guard is the first statement of every action", () => {
    expect(expectGuardFirstInEveryAction("src/interface/admin/pillars/actions.ts").sort()).toEqual(Object.keys(ACTION_CALLS).sort());
  });
});
