import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookiesMock, getCommandUseCasesMock, revalidatePathMock, redirectMock, useCases } = vi.hoisted(() => {
  const execute = () => vi.fn(async () => ({ id: "cmd-1" }));
  const useCases = {
    create: { execute: execute() },
    update: { execute: execute() },
    setPublished: { execute: execute() },
    delete: { execute: execute() },
    move: { execute: execute() },
  };

  return {
    cookiesMock: vi.fn(),
    getCommandUseCasesMock: vi.fn(() => useCases),
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
vi.mock("@/interface/admin/commands/commands-container", () => ({ getCommandUseCases: getCommandUseCasesMock }));

import { AUTH_COOKIE_NAME, signSession } from "@/infrastructure/auth/session-jwt";
import * as actions from "@/interface/admin/commands/actions";
import { expectGuardFirstInEveryAction } from "@/tests/support/guard-first";

const SESSION_EXPIRED = { error: "Su sesión expiró. Inicie sesión de nuevo." };

function commandForm(): FormData {
  const form = new FormData();
  form.set("command", "horario");
  form.set("description", "Cuándo");
  form.set("output", "Martes.");
  return form;
}

// One entry per exported action: the test below fails when an action is added without a case here.
const ACTION_CALLS: Record<string, () => Promise<unknown>> = {
  createCommand: () => actions.createCommand(null, commandForm()),
  updateCommand: () => actions.updateCommand("cmd-1", null, commandForm()),
  setCommandPublished: () => actions.setCommandPublished("cmd-1", true),
  deleteCommand: () => actions.deleteCommand("cmd-1"),
  moveCommand: () => actions.moveCommand("cmd-1", "up"),
};

function cookieJar(value: string | undefined) {
  cookiesMock.mockResolvedValue({
    get: (name: string) => (name === AUTH_COOKIE_NAME && value !== undefined ? { name, value } : undefined),
  });
}

describe("command server actions require an admin session (L9)", () => {
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
      expect(getCommandUseCasesMock).not.toHaveBeenCalled();
      for (const useCase of Object.values(useCases)) {
        expect(useCase.execute).not.toHaveBeenCalled();
      }
      expect(revalidatePathMock).not.toHaveBeenCalled();
      expect(redirectMock).not.toHaveBeenCalled();
    });
  });

  it("positive control: a valid session reaches the use cases", async () => {
    cookieJar(await signSession());

    await expect(actions.deleteCommand("cmd-1")).resolves.toEqual({ success: true });

    expect(useCases.delete.execute).toHaveBeenCalledWith({ id: "cmd-1" });
  });

  it("the guard is the first statement of every action", () => {
    expect(expectGuardFirstInEveryAction("src/interface/admin/commands/actions.ts").sort()).toEqual(Object.keys(ACTION_CALLS).sort());
  });
});
