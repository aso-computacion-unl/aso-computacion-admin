import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireSessionMock, revalidatePathMock, redirectMock, useCases } = vi.hoisted(() => ({
  requireSessionMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  redirectMock: vi.fn(() => {
    throw new Error("REDIRECT");
  }),
  useCases: {
    create: { execute: vi.fn() },
    update: { execute: vi.fn() },
    setPublished: { execute: vi.fn() },
    trash: { execute: vi.fn() },
    move: { execute: vi.fn() },
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("@/interface/auth/require-session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/interface/auth/require-session")>()),
  requireSession: requireSessionMock,
  requireRole: requireSessionMock,
}));
vi.mock("@/interface/admin/impact/impact-container", () => ({ getImpactStatUseCases: () => useCases }));

import { NotFoundError } from "@/application";
import { ValidationError } from "@/domain";
import * as actions from "@/interface/admin/impact/actions";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const FIELDS = { value: "120+", label: "Estudiantes" };

describe("impact stat server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireSessionMock.mockResolvedValue({ kind: "user", sessionId: "s1", userId: "u1", name: "Ana", role: "EDITOR" });
    useCases.trash.execute.mockResolvedValue({ wasPublished: true });
  });

  it("createImpactStat creates, refreshes the list and continues on the edit page", async () => {
    useCases.create.execute.mockResolvedValue({ id: "stat-1" });

    await expect(actions.createImpactStat(null, form(FIELDS))).rejects.toThrow("REDIRECT");

    expect(useCases.create.execute).toHaveBeenCalledWith({ ...FIELDS, isPublished: false });
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/impact");
    expect(redirectMock).toHaveBeenCalledWith("/admin/impact/stat-1/edit");
  });

  it("maps a limit error to the stat's own wording and rejects unknown fields without writing", async () => {
    useCases.create.execute.mockRejectedValue(new ValidationError("label", "too long"));

    expect((await actions.createImpactStat(null, form(FIELDS))).fieldErrors?.label).toContain("60");

    useCases.create.execute.mockClear();
    const unknown = await actions.createImpactStat(null, form({ ...FIELDS, sortOrder: "0" }));

    expect(unknown.fieldErrors?.form).toBeTruthy();
    expect(useCases.create.execute).not.toHaveBeenCalled();
  });

  it("update, publish, trash and move delegate and refresh", async () => {
    useCases.update.execute.mockResolvedValue({});

    await expect(actions.updateImpactStat("stat-1", null, form(FIELDS))).resolves.toEqual({ success: true });
    await expect(actions.setImpactStatPublished("stat-1", true)).resolves.toEqual({ success: true });
    await expect(actions.trashImpactStat("stat-1")).resolves.toEqual({ success: true });
    await expect(actions.moveImpactStat("stat-1", "down")).resolves.toEqual({ success: true });

    expect(useCases.update.execute).toHaveBeenCalledWith({ id: "stat-1", ...FIELDS, isPublished: false });
    expect(useCases.setPublished.execute).toHaveBeenCalledWith({ id: "stat-1", isPublished: true });
    expect(useCases.trash.execute).toHaveBeenCalledWith({ id: "stat-1" });
    expect(useCases.move.execute).toHaveBeenCalledWith({ id: "stat-1", direction: "down" });
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/impact");
  });

  it("moveImpactStat rejects a direction that is not up or down", async () => {
    expect((await actions.moveImpactStat("stat-1", "sideways" as "up")).error).toBeTruthy();
    expect(useCases.move.execute).not.toHaveBeenCalled();
  });

  it("maps NotFoundError to a message that names the stat", async () => {
    useCases.trash.execute.mockRejectedValue(new NotFoundError("Impact stat not found"));

    expect((await actions.trashImpactStat("gone")).error).toContain("cifra");
  });
});
