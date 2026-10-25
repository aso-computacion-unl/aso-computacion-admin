import { expect, vi } from "vitest";

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

import * as actions from "@/interface/admin/commands/actions";
import { describeAdminActionAuth } from "@/tests/support/admin-action-auth";

function commandForm(): FormData {
  const form = new FormData();
  form.set("command", "horario");
  form.set("description", "Cuándo");
  form.set("output", "Martes.");
  return form;
}

describeAdminActionAuth({
  title: "command server actions require an admin session (L9)",
  actionsPath: "src/interface/admin/commands/actions.ts",
  actions,
  actionCalls: {
    createCommand: () => actions.createCommand(null, commandForm()),
    updateCommand: () => actions.updateCommand("cmd-1", null, commandForm()),
    setCommandPublished: () => actions.setCommandPublished("cmd-1", true),
    deleteCommand: () => actions.deleteCommand("cmd-1"),
    moveCommand: () => actions.moveCommand("cmd-1", "up"),
  },
  cookiesMock,
  untouchedMocks: [getCommandUseCasesMock, ...Object.values(useCases).map((useCase) => useCase.execute), revalidatePathMock, redirectMock],
  positiveControl: async () => {
    await expect(actions.deleteCommand("cmd-1")).resolves.toEqual({ success: true });
    expect(useCases.delete.execute).toHaveBeenCalledWith({ id: "cmd-1" });
  },
});
