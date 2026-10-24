import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireAdminSessionMock, revalidatePathMock, redirectMock, useCases } = vi.hoisted(() => ({
  requireAdminSessionMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  redirectMock: vi.fn(() => {
    throw new Error("REDIRECT");
  }),
  useCases: {
    create: { execute: vi.fn() },
    update: { execute: vi.fn() },
    setPublished: { execute: vi.fn() },
    delete: { execute: vi.fn() },
    move: { execute: vi.fn() },
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("@/interface/auth/require-admin-session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/interface/auth/require-admin-session")>()),
  requireAdminSession: requireAdminSessionMock,
}));
vi.mock("@/interface/admin/commands/commands-container", () => ({ getCommandUseCases: () => useCases }));

import { NotFoundError } from "@/application";
import { CommandNameConflictError, ValidationError } from "@/domain";
import * as actions from "@/interface/admin/commands/actions";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe("command server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminSessionMock.mockResolvedValue(undefined);
  });

  it("createCommand creates the command, refreshes the list and redirects to it", async () => {
    useCases.create.execute.mockResolvedValue({ id: "cmd-1" });

    await expect(actions.createCommand(null, form({ command: " horario ", description: " Cuándo ", output: "Martes.\nJueves.", isPublished: "on" }))).rejects.toThrow("REDIRECT");

    expect(useCases.create.execute).toHaveBeenCalledWith({ command: "horario", description: "Cuándo", output: "Martes.\nJueves.", isPublished: true });
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/commands");
    expect(redirectMock).toHaveBeenCalledWith("/admin/commands");
  });

  it("returns Spanish field errors for a domain failure and a malformed form, without writing", async () => {
    useCases.create.execute.mockRejectedValue(new ValidationError("output", "output is required"));

    expect((await actions.createCommand(null, form({ command: "horario", description: "d", output: "x" }))).fieldErrors).toEqual({
      output: expect.stringContaining("respuesta"),
    });

    useCases.create.execute.mockRejectedValue(new ValidationError("description", "description is required"));

    expect((await actions.createCommand(null, form({ command: "horario", description: "d", output: "x" }))).fieldErrors).toEqual({
      description: expect.stringContaining("80 caracteres"),
    });

    useCases.create.execute.mockClear();
    const unknown = await actions.createCommand(null, form({ command: "horario", description: "d", output: "o", sortOrder: "0" }));

    expect(unknown.fieldErrors?.form).toBeTruthy();
    expect(useCases.create.execute).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("updateCommand passes the id and the parsed form", async () => {
    useCases.update.execute.mockResolvedValue({});

    await expect(actions.updateCommand("cmd-1", null, form({ command: "horario", description: "d", output: "o" }))).resolves.toEqual({ success: true });

    expect(useCases.update.execute).toHaveBeenCalledWith({ id: "cmd-1", command: "horario", description: "d", output: "o", isPublished: false });
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/commands");
  });

  it("setCommandPublished, deleteCommand and moveCommand delegate and refresh the list", async () => {
    await expect(actions.setCommandPublished("cmd-1", true)).resolves.toEqual({ success: true });
    await expect(actions.deleteCommand("cmd-1")).resolves.toEqual({ success: true });
    await expect(actions.moveCommand("cmd-1", "down")).resolves.toEqual({ success: true });

    expect(useCases.setPublished.execute).toHaveBeenCalledWith({ id: "cmd-1", isPublished: true });
    expect(useCases.delete.execute).toHaveBeenCalledWith({ id: "cmd-1" });
    expect(useCases.move.execute).toHaveBeenCalledWith({ id: "cmd-1", direction: "down" });
    expect(revalidatePathMock).toHaveBeenCalledTimes(3);
  });

  it("moveCommand rejects a direction that is not up or down", async () => {
    const result = await actions.moveCommand("cmd-1", "sideways" as "up");

    expect(result.error).toBeTruthy();
    expect(useCases.move.execute).not.toHaveBeenCalled();
  });

  it("maps NotFoundError to a message that names the command", async () => {
    useCases.delete.execute.mockRejectedValue(new NotFoundError("Terminal command not found"));

    expect((await actions.deleteCommand("gone")).error).toContain("comando");
  });

  it("returns a Spanish command-field error naming the conflict, and writes nothing more", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    useCases.create.execute.mockRejectedValue(new CommandNameConflictError("command", "help", "reserved"));

    const result = await actions.createCommand(null, form({ command: "help", description: "d", output: "o" }));

    expect(result.fieldErrors).toEqual({ command: expect.stringContaining("«help»") });
    expect(revalidatePathMock).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
