import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireAdminSessionMock, revalidatePathMock, redirectMock, requestSiteRebuildMock, useCases } = vi.hoisted(() => ({
  requireAdminSessionMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  redirectMock: vi.fn(() => {
    throw new Error("REDIRECT");
  }),
  requestSiteRebuildMock: vi.fn(),
  useCases: {
    create: { execute: vi.fn() },
    update: { execute: vi.fn() },
    setPublished: { execute: vi.fn() },
    trash: { execute: vi.fn() },
    setCover: { execute: vi.fn() },
    removeCover: { execute: vi.fn() },
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("@/infrastructure/deploy/deploy-hook", () => ({ requestSiteRebuild: requestSiteRebuildMock }));
vi.mock("@/interface/auth/require-admin-session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/interface/auth/require-admin-session")>()),
  requireAdminSession: requireAdminSessionMock,
}));
vi.mock("@/interface/admin/news/news-container", () => ({ getNewsUseCases: () => useCases }));

import { NotFoundError } from "@/application";
import { ImageTooSmallError, ValidationError } from "@/domain";
import * as actions from "@/interface/admin/news/actions";

function form(fields: Record<string, string | File>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const jpeg = () => new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0])], "a.jpg", { type: "image/jpeg" });
const FIELDS = { title: "Taller de Git", summary: "Resumen", body: "Cuerpo" };

describe("news server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminSessionMock.mockResolvedValue(undefined);
    useCases.trash.execute.mockResolvedValue({ wasPublished: true });
  });

  it("createNewsItem creates, asks for a rebuild, refreshes the list and continues on the edit page (the cover needs an id)", async () => {
    useCases.create.execute.mockResolvedValue({ id: "news-1" });

    await expect(actions.createNewsItem(null, form({ ...FIELDS, slug: "git", publishedAt: "2026-03-14" }))).rejects.toThrow("REDIRECT");

    expect(useCases.create.execute).toHaveBeenCalledWith({
      ...FIELDS,
      slug: "git",
      publishedAt: "2026-03-14",
      isPublished: false,
      coverAlt: undefined,
    });
    expect(requestSiteRebuildMock).toHaveBeenCalledTimes(1);
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/news");
    expect(redirectMock).toHaveBeenCalledWith("/admin/news/news-1/edit");
  });

  it("a failed create neither rebuilds nor redirects, and shows the field message with the news limits", async () => {
    useCases.create.execute.mockRejectedValue(new ValidationError("summary", "too long"));

    const result = await actions.createNewsItem(null, form(FIELDS));

    expect(result.fieldErrors?.summary).toContain("280");
    expect(requestSiteRebuildMock).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it.each([
    ["body", "10000"],
    ["publishedAt", "fecha"],
    ["slug", "identificador"],
    ["title", "120"],
    ["coverAlt", "200"],
  ])("explains a %s validation error", async (field, text) => {
    useCases.update.execute.mockRejectedValue(new ValidationError(field, "bad"));

    expect((await actions.updateNewsItem("news-1", null, form(FIELDS))).fieldErrors?.[field]).toContain(text);
  });

  it("rejects unknown form fields without writing", async () => {
    const unknown = await actions.createNewsItem(null, form({ ...FIELDS, sortOrder: "0" }));

    expect(unknown.fieldErrors?.form).toBeTruthy();
    expect(useCases.create.execute).not.toHaveBeenCalled();
  });

  it("updateNewsItem passes the id and the parsed form, rebuilds and refreshes the list and the edit page", async () => {
    useCases.update.execute.mockResolvedValue({});

    await expect(actions.updateNewsItem("news-1", null, form({ ...FIELDS, coverAlt: "Taller", isPublished: "on" }))).resolves.toEqual({ success: true });

    expect(useCases.update.execute).toHaveBeenCalledWith({
      id: "news-1",
      ...FIELDS,
      slug: undefined,
      publishedAt: undefined,
      coverAlt: "Taller",
      isPublished: true,
    });
    expect(requestSiteRebuildMock).toHaveBeenCalledTimes(1);
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/news");
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/news/news-1/edit");
  });

  it("publish and delete delegate, rebuild and refresh", async () => {
    await expect(actions.setNewsItemPublished("news-1", true)).resolves.toEqual({ success: true });
    await expect(actions.trashNewsItem("news-1")).resolves.toEqual({ success: true });

    expect(useCases.setPublished.execute).toHaveBeenCalledWith({ id: "news-1", isPublished: true });
    expect(useCases.trash.execute).toHaveBeenCalledWith({ id: "news-1" });
    expect(requestSiteRebuildMock).toHaveBeenCalledTimes(2);
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/news");
  });

  it("maps NotFoundError to a message that names the news item, not an event", async () => {
    useCases.trash.execute.mockRejectedValue(new NotFoundError("News item not found"));

    const result = await actions.trashNewsItem("gone");

    expect(result.error).toContain("novedad");
    expect(requestSiteRebuildMock).not.toHaveBeenCalled();
  });

  describe("cover", () => {
    it("uploadNewsCover validates the file, then passes it with the alt", async () => {
      useCases.setCover.execute.mockResolvedValue({});

      expect(await actions.uploadNewsCover("news-1", null, form({ file: jpeg(), coverAlt: "Taller" }))).toEqual({ success: true });

      expect(useCases.setCover.execute).toHaveBeenCalledWith({
        id: "news-1",
        file: expect.objectContaining({ name: "a.jpg", type: "image/jpeg" }),
        alt: "Taller",
      });
      expect(requestSiteRebuildMock).toHaveBeenCalledTimes(1);
      expect(revalidatePathMock).toHaveBeenCalledWith("/admin/news/news-1/edit");
    });

    it("rejects a missing file, a wrong type and a spoofed signature before any upload", async () => {
      const noFile = await actions.uploadNewsCover("news-1", null, form({ coverAlt: "x" }));
      const gif = await actions.uploadNewsCover("news-1", null, form({ file: new File([new Uint8Array(8)], "a.gif", { type: "image/gif" }), coverAlt: "x" }));
      const spoofed = await actions.uploadNewsCover("news-1", null, form({ file: new File([new Uint8Array(16)], "a.jpg", { type: "image/jpeg" }), coverAlt: "x" }));

      for (const result of [noFile, gif, spoofed]) {
        expect(result.fieldErrors?.file).toContain("JPEG, PNG o WebP");
      }
      expect(useCases.setCover.execute).not.toHaveBeenCalled();
      expect(requestSiteRebuildMock).not.toHaveBeenCalled();
    });

    it("explains the minimum width", async () => {
      useCases.setCover.execute.mockRejectedValueOnce(new ImageTooSmallError(1200, 576));

      expect((await actions.uploadNewsCover("news-1", null, form({ file: jpeg(), coverAlt: "x" }))).fieldErrors?.file).toContain("576");
    });

    it("removeNewsCover delegates, rebuilds and refreshes the edit page", async () => {
      useCases.removeCover.execute.mockResolvedValue({});

      expect(await actions.removeNewsCover("news-1")).toEqual({ success: true });

      expect(useCases.removeCover.execute).toHaveBeenCalledWith({ id: "news-1" });
      expect(requestSiteRebuildMock).toHaveBeenCalledTimes(1);
      expect(revalidatePathMock).toHaveBeenCalledWith("/admin/news/news-1/edit");
    });
  });
});
