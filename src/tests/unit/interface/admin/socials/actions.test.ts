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
vi.mock("@/interface/admin/socials/socials-container", () => ({ getSocialLinkUseCases: () => useCases }));

import { NotFoundError } from "@/application";
import { ValidationError } from "@/domain";
import * as actions from "@/interface/admin/socials/actions";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const FIELDS = { platform: "tiktok", label: "TikTok", handle: "@aso", url: "https://tiktok.com/@aso", note: "", blurb: "" };
const PARSED = { ...FIELDS, isPublished: false };

describe("social link server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminSessionMock.mockResolvedValue(undefined);
  });

  it("createSocialLink creates the link, refreshes the list and redirects to it", async () => {
    useCases.create.execute.mockResolvedValue({ id: "social-1" });

    await expect(actions.createSocialLink(null, form(FIELDS))).rejects.toThrow("REDIRECT");

    expect(useCases.create.execute).toHaveBeenCalledWith(PARSED);
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/socials");
    expect(redirectMock).toHaveBeenCalledWith("/admin/socials");
  });

  it("returns a Spanish field error for a bad link and rejects unknown fields, without writing", async () => {
    useCases.create.execute.mockRejectedValue(new ValidationError("url", "url must be a valid https URL"));

    expect((await actions.createSocialLink(null, form({ ...FIELDS, url: "http://x" }))).fieldErrors).toEqual({
      url: expect.stringContaining("https://"),
    });

    useCases.create.execute.mockClear();
    const unknown = await actions.createSocialLink(null, form({ ...FIELDS, sortOrder: "0" }));

    expect(unknown.fieldErrors?.form).toBeTruthy();
    expect(useCases.create.execute).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("updateSocialLink passes the id and the parsed form", async () => {
    useCases.update.execute.mockResolvedValue({});

    await expect(actions.updateSocialLink("social-1", null, form(FIELDS))).resolves.toEqual({ success: true });

    expect(useCases.update.execute).toHaveBeenCalledWith({ id: "social-1", ...PARSED });
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/socials");
  });

  it("publish, delete and move delegate and refresh the list", async () => {
    await expect(actions.setSocialLinkPublished("social-1", true)).resolves.toEqual({ success: true });
    await expect(actions.deleteSocialLink("social-1")).resolves.toEqual({ success: true });
    await expect(actions.moveSocialLink("social-1", "down")).resolves.toEqual({ success: true });

    expect(useCases.setPublished.execute).toHaveBeenCalledWith({ id: "social-1", isPublished: true });
    expect(useCases.delete.execute).toHaveBeenCalledWith({ id: "social-1" });
    expect(useCases.move.execute).toHaveBeenCalledWith({ id: "social-1", direction: "down" });
    expect(revalidatePathMock).toHaveBeenCalledTimes(3);
  });

  it("moveSocialLink rejects a direction that is not up or down", async () => {
    expect((await actions.moveSocialLink("social-1", "sideways" as "up")).error).toBeTruthy();
    expect(useCases.move.execute).not.toHaveBeenCalled();
  });

  it("maps NotFoundError to a message that names the link", async () => {
    useCases.delete.execute.mockRejectedValue(new NotFoundError("Social link not found"));

    expect((await actions.deleteSocialLink("gone")).error).toContain("red social");
  });
});
