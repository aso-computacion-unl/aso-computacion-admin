import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireSessionMock, revalidatePathMock, useCases } = vi.hoisted(() => ({
  requireSessionMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  useCases: { update: { execute: vi.fn() } },
}));

vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("@/interface/auth/require-session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/interface/auth/require-session")>()),
  requireSession: requireSessionMock,
  requireRole: requireSessionMock,
}));
vi.mock("@/interface/admin/settings/settings-container", () => ({ getSiteSettingsUseCases: () => useCases }));

import { ValidationError } from "@/domain";
import * as actions from "@/interface/admin/settings/actions";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const FIELDS = { tagline: "Lema", description: "Descripción", about: "Acerca" };

describe("updateSiteSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireSessionMock.mockResolvedValue({ kind: "user", sessionId: "s1", userId: "u1", name: "Ana", role: "ADMIN" });
  });

  it("saves the settings and refreshes the page", async () => {
    useCases.update.execute.mockResolvedValue(FIELDS);

    await expect(actions.updateSiteSettings(null, form(FIELDS))).resolves.toEqual({ success: true });

    expect(useCases.update.execute).toHaveBeenCalledWith(FIELDS);
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/settings");
  });

  it("reports the settings' own limits, not the event description's", async () => {
    useCases.update.execute.mockRejectedValueOnce(new ValidationError("description", "too long"));
    useCases.update.execute.mockRejectedValueOnce(new ValidationError("about", "too long"));
    useCases.update.execute.mockRejectedValueOnce(new ValidationError("tagline", "too long"));

    expect((await actions.updateSiteSettings(null, form(FIELDS))).fieldErrors?.description).toContain("300");
    expect((await actions.updateSiteSettings(null, form(FIELDS))).fieldErrors?.about).toContain("600");
    expect((await actions.updateSiteSettings(null, form(FIELDS))).fieldErrors?.tagline).toContain("120");
  });

  it("rejects unknown fields without writing", async () => {
    const result = await actions.updateSiteSettings(null, form({ ...FIELDS, id: "other" }));

    expect(result.fieldErrors?.form).toBeTruthy();
    expect(useCases.update.execute).not.toHaveBeenCalled();
  });
});
