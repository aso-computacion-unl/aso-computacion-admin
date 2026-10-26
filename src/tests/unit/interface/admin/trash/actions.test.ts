import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireSessionMock, revalidatePathMock, restore, purge } = vi.hoisted(() => ({
  requireSessionMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  restore: vi.fn(),
  purge: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("@/interface/auth/require-session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/interface/auth/require-session")>()),
  requireSession: requireSessionMock,
  requireRole: requireSessionMock,
}));
// Each kind gets its own stub so a test can tell which one a call reached.
const byKind = (operation: typeof restore) => new Proxy({}, { get: (_target, kind) => ({ execute: (command: { id: string }) => operation(kind, command) }) });
vi.mock("@/interface/admin/trash/trash-container", () => ({
  getTrashUseCases: () => ({ restore: byKind(restore), purge: byKind(purge) }),
}));

import { NotFoundError, RestoreConflictError } from "@/application";
import * as actions from "@/interface/admin/trash/actions";

describe("trash server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireSessionMock.mockResolvedValue({ kind: "user", sessionId: "s1", userId: "u1", name: "Ana", role: "ADMIN" });
  });

  it("restoreTrashed restores the kind it is given and refreshes the trash and that kind's list", async () => {
    await expect(actions.restoreTrashed("news", "n1")).resolves.toEqual({ success: true });

    expect(restore).toHaveBeenCalledWith("news", { id: "n1" });
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/papelera");
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/news");
    expect(purge).not.toHaveBeenCalled();
  });

  it("purgeTrashed purges the kind it is given and refreshes only the trash", async () => {
    await expect(actions.purgeTrashed("event", "e1")).resolves.toEqual({ success: true });

    expect(purge).toHaveBeenCalledWith("event", { id: "e1" });
    expect(revalidatePathMock).toHaveBeenCalledTimes(1);
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/papelera");
    expect(restore).not.toHaveBeenCalled();
  });

  it.each(["restoreTrashed", "purgeTrashed"] as const)("%s refuses a kind it does not know before touching any use case", async (name) => {
    for (const kind of ["", "users", "__proto__", "FAQ"]) {
      expect(await actions[name](kind, "x")).toEqual({ error: "El tipo de elemento no es válido." });
    }

    expect(restore).not.toHaveBeenCalled();
    expect(purge).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("says in Spanish that an item is no longer in the trash", async () => {
    restore.mockRejectedValueOnce(new NotFoundError("Faq not found"));
    purge.mockRejectedValueOnce(new NotFoundError("Faq not found"));

    expect(await actions.restoreTrashed("faq", "gone")).toEqual({ error: "El elemento ya no está en la papelera." });
    expect(await actions.purgeTrashed("faq", "gone")).toEqual({ error: "El elemento ya no está en la papelera." });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("explains a restore collision in Spanish and refreshes nothing", async () => {
    restore.mockRejectedValueOnce(new RestoreConflictError("slug", "charla", "event"));

    const result = await actions.restoreTrashed("event", "e1");

    expect(result.error).toMatch(/No se puede restaurar.*«charla».*otro evento/);
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });
});
