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
    setImage: { execute: vi.fn() },
    removeImage: { execute: vi.fn() },
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("@/interface/auth/require-admin-session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/interface/auth/require-admin-session")>()),
  requireAdminSession: requireAdminSessionMock,
}));
vi.mock("@/interface/admin/pillars/pillars-container", () => ({ getPillarUseCases: () => useCases }));

import { NotFoundError } from "@/application";
import { ImageTooSmallError, ValidationError } from "@/domain";
import * as actions from "@/interface/admin/pillars/actions";

function form(fields: Record<string, string | File>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const jpeg = () => new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0])], "a.jpg", { type: "image/jpeg" });
const FIELDS = { word: "VOZ", title: "Representamos", text: "Texto" };

describe("pillar server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminSessionMock.mockResolvedValue(undefined);
  });

  it("createPillar creates the pillar, refreshes the list and continues on its edit page (the image needs an id)", async () => {
    useCases.create.execute.mockResolvedValue({ id: "pillar-1" });

    await expect(actions.createPillar(null, form(FIELDS))).rejects.toThrow("REDIRECT");

    expect(useCases.create.execute).toHaveBeenCalledWith({ ...FIELDS, isPublished: false });
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/pillars");
    expect(redirectMock).toHaveBeenCalledWith("/admin/pillars/pillar-1/edit");
  });

  it("uses the pillar's own length limits in the title message and rejects unknown fields without writing", async () => {
    useCases.create.execute.mockRejectedValue(new ValidationError("title", "too long"));

    expect((await actions.createPillar(null, form(FIELDS))).fieldErrors?.title).toContain("60");

    useCases.create.execute.mockClear();
    const unknown = await actions.createPillar(null, form({ ...FIELDS, sortOrder: "0" }));

    expect(unknown.fieldErrors?.form).toBeTruthy();
    expect(useCases.create.execute).not.toHaveBeenCalled();
  });

  it("updatePillar passes the id, the parsed form and the alt when sent", async () => {
    useCases.update.execute.mockResolvedValue({});

    await expect(actions.updatePillar("pillar-1", null, form({ ...FIELDS, imageAlt: "Charla" }))).resolves.toEqual({ success: true });

    expect(useCases.update.execute).toHaveBeenCalledWith({ id: "pillar-1", ...FIELDS, imageAlt: "Charla", isPublished: false });
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/pillars");
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/pillars/pillar-1/edit");
  });

  it("publish, delete and move delegate and refresh", async () => {
    await expect(actions.setPillarPublished("pillar-1", true)).resolves.toEqual({ success: true });
    await expect(actions.deletePillar("pillar-1")).resolves.toEqual({ success: true });
    await expect(actions.movePillar("pillar-1", "down")).resolves.toEqual({ success: true });

    expect(useCases.setPublished.execute).toHaveBeenCalledWith({ id: "pillar-1", isPublished: true });
    expect(useCases.delete.execute).toHaveBeenCalledWith({ id: "pillar-1" });
    expect(useCases.move.execute).toHaveBeenCalledWith({ id: "pillar-1", direction: "down" });
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/pillars");
  });

  it("movePillar rejects a direction that is not up or down", async () => {
    expect((await actions.movePillar("pillar-1", "sideways" as "up")).error).toBeTruthy();
    expect(useCases.move.execute).not.toHaveBeenCalled();
  });

  it("maps NotFoundError to a message that names the pillar", async () => {
    useCases.delete.execute.mockRejectedValue(new NotFoundError("Pillar not found"));

    expect((await actions.deletePillar("gone")).error).toContain("pilar");
  });

  describe("images", () => {
    it("uploadPillarImage validates the file, then passes it with the alt", async () => {
      useCases.setImage.execute.mockResolvedValue({});

      expect(await actions.uploadPillarImage("pillar-1", null, form({ file: jpeg(), imageAlt: "Charla" }))).toEqual({ success: true });

      expect(useCases.setImage.execute).toHaveBeenCalledWith({
        id: "pillar-1",
        file: expect.objectContaining({ name: "a.jpg", type: "image/jpeg" }),
        alt: "Charla",
      });
      expect(revalidatePathMock).toHaveBeenCalledWith("/admin/pillars/pillar-1/edit");
    });

    it("rejects a missing file, a wrong type and a spoofed signature before any upload", async () => {
      const noFile = await actions.uploadPillarImage("pillar-1", null, form({ imageAlt: "x" }));
      const gif = await actions.uploadPillarImage("pillar-1", null, form({ file: new File([new Uint8Array(8)], "a.gif", { type: "image/gif" }), imageAlt: "x" }));
      const spoofed = await actions.uploadPillarImage("pillar-1", null, form({ file: new File([new Uint8Array(16)], "a.jpg", { type: "image/jpeg" }), imageAlt: "x" }));

      for (const result of [noFile, gif, spoofed]) {
        expect(result.fieldErrors?.file).toContain("JPEG, PNG o WebP");
      }
      expect(useCases.setImage.execute).not.toHaveBeenCalled();
    });

    it("explains the minimum width and the alt rule", async () => {
      useCases.setImage.execute.mockRejectedValueOnce(new ImageTooSmallError(1200, 576));
      expect((await actions.uploadPillarImage("pillar-1", null, form({ file: jpeg(), imageAlt: "x" }))).fieldErrors?.file).toContain("576");

      useCases.setImage.execute.mockRejectedValueOnce(new ValidationError("imageAlt", "required"));
      expect((await actions.uploadPillarImage("pillar-1", null, form({ file: jpeg(), imageAlt: "" }))).fieldErrors?.imageAlt).toContain("200");
    });

    it("removePillarImage delegates and refreshes the edit page", async () => {
      useCases.removeImage.execute.mockResolvedValue({});

      expect(await actions.removePillarImage("pillar-1")).toEqual({ success: true });

      expect(useCases.removeImage.execute).toHaveBeenCalledWith({ id: "pillar-1" });
      expect(revalidatePathMock).toHaveBeenCalledWith("/admin/pillars/pillar-1/edit");
    });
  });
});
