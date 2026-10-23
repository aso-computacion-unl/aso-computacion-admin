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
    setPhoto: { execute: vi.fn() },
    removePhoto: { execute: vi.fn() },
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("@/interface/auth/require-admin-session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/interface/auth/require-admin-session")>()),
  requireAdminSession: requireAdminSessionMock,
}));
vi.mock("@/interface/admin/board/board-members-container", () => ({ getBoardMemberUseCases: () => useCases }));

import { NotFoundError } from "@/application";
import { ImageTooSmallError, ValidationError } from "@/domain";
import * as actions from "@/interface/admin/board/actions";

function form(fields: Record<string, string | File>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const jpeg = () => new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0])], "a.jpg", { type: "image/jpeg" });
const FIELDS = { name: "Ana Pérez", role: "Presidenta" };

describe("board member server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminSessionMock.mockResolvedValue(undefined);
  });

  it("createBoardMember creates the member, refreshes the list and continues on its edit page (the photo needs an id)", async () => {
    useCases.create.execute.mockResolvedValue({ id: "member-1" });

    await expect(actions.createBoardMember(null, form(FIELDS))).rejects.toThrow("REDIRECT");

    expect(useCases.create.execute).toHaveBeenCalledWith({ ...FIELDS, isPublished: false });
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/board");
    expect(redirectMock).toHaveBeenCalledWith("/admin/board/member-1/edit");
  });

  it("rejects contact and unknown fields without writing (S4)", async () => {
    for (const field of ["phone", "email", "age", "instagram", "sortOrder"]) {
      const result = await actions.createBoardMember(null, form({ ...FIELDS, [field]: "x" }));

      expect(result.fieldErrors?.form).toBeTruthy();
    }
    expect((await actions.updateBoardMember("member-1", null, form({ ...FIELDS, phone: "0999" }))).fieldErrors?.form).toBeTruthy();
    expect(useCases.create.execute).not.toHaveBeenCalled();
    expect(useCases.update.execute).not.toHaveBeenCalled();
  });

  it("tells the owner to upload a photo before publishing", async () => {
    useCases.update.execute.mockRejectedValue(new ValidationError("photo", "needs a photo"));

    const result = await actions.updateBoardMember("member-1", null, form({ ...FIELDS, isPublished: "on" }));

    expect(result.fieldErrors?.photo).toContain("foto");
  });

  it("updateBoardMember passes the id, the parsed form and the alt when sent", async () => {
    useCases.update.execute.mockResolvedValue({});

    await expect(actions.updateBoardMember("member-1", null, form({ ...FIELDS, photoAlt: "Ana" }))).resolves.toEqual({ success: true });

    expect(useCases.update.execute).toHaveBeenCalledWith({ id: "member-1", ...FIELDS, photoAlt: "Ana", isPublished: false });
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/board");
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/board/member-1/edit");
  });

  it("publish, delete and move delegate and refresh", async () => {
    await expect(actions.setBoardMemberPublished("member-1", true)).resolves.toEqual({ success: true });
    await expect(actions.deleteBoardMember("member-1")).resolves.toEqual({ success: true });
    await expect(actions.moveBoardMember("member-1", "down")).resolves.toEqual({ success: true });

    expect(useCases.setPublished.execute).toHaveBeenCalledWith({ id: "member-1", isPublished: true });
    expect(useCases.delete.execute).toHaveBeenCalledWith({ id: "member-1" });
    expect(useCases.move.execute).toHaveBeenCalledWith({ id: "member-1", direction: "down" });
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/board");
  });

  it("publishing a member without a photo reports the photo rule instead of failing silently", async () => {
    useCases.setPublished.execute.mockRejectedValue(new ValidationError("photo", "needs a photo"));

    expect((await actions.setBoardMemberPublished("member-1", true)).fieldErrors?.photo).toContain("foto");
  });

  it("moveBoardMember rejects a direction that is not up or down", async () => {
    expect((await actions.moveBoardMember("member-1", "sideways" as "up")).error).toBeTruthy();
    expect(useCases.move.execute).not.toHaveBeenCalled();
  });

  it("maps NotFoundError to a message that names the member", async () => {
    useCases.delete.execute.mockRejectedValue(new NotFoundError("Board member not found"));

    expect((await actions.deleteBoardMember("gone")).error).toContain("integrante");
  });

  describe("photos", () => {
    it("uploadBoardMemberPhoto validates the file, then passes it with the alt", async () => {
      useCases.setPhoto.execute.mockResolvedValue({});

      expect(await actions.uploadBoardMemberPhoto("member-1", null, form({ file: jpeg(), photoAlt: "Ana" }))).toEqual({ success: true });

      expect(useCases.setPhoto.execute).toHaveBeenCalledWith({
        id: "member-1",
        file: expect.objectContaining({ name: "a.jpg", type: "image/jpeg" }),
        alt: "Ana",
      });
      expect(revalidatePathMock).toHaveBeenCalledWith("/admin/board/member-1/edit");
    });

    it("rejects a missing file, a wrong type and a spoofed signature before any upload", async () => {
      const noFile = await actions.uploadBoardMemberPhoto("member-1", null, form({ photoAlt: "x" }));
      const gif = await actions.uploadBoardMemberPhoto("member-1", null, form({ file: new File([new Uint8Array(8)], "a.gif", { type: "image/gif" }), photoAlt: "x" }));
      const spoofed = await actions.uploadBoardMemberPhoto("member-1", null, form({ file: new File([new Uint8Array(16)], "a.jpg", { type: "image/jpeg" }), photoAlt: "x" }));

      for (const result of [noFile, gif, spoofed]) {
        expect(result.fieldErrors?.file).toContain("JPEG, PNG o WebP");
      }
      expect(useCases.setPhoto.execute).not.toHaveBeenCalled();
    });

    it("explains the minimum width and the alt rule", async () => {
      useCases.setPhoto.execute.mockRejectedValueOnce(new ImageTooSmallError(577, 500));
      expect((await actions.uploadBoardMemberPhoto("member-1", null, form({ file: jpeg(), photoAlt: "x" }))).fieldErrors?.file).toContain("500");

      useCases.setPhoto.execute.mockRejectedValueOnce(new ValidationError("photoAlt", "required"));
      expect((await actions.uploadBoardMemberPhoto("member-1", null, form({ file: jpeg(), photoAlt: "" }))).fieldErrors?.photoAlt).toContain("200");
    });

    it("removeBoardMemberPhoto delegates and refreshes the list and the edit page", async () => {
      useCases.removePhoto.execute.mockResolvedValue({});

      expect(await actions.removeBoardMemberPhoto("member-1")).toEqual({ success: true });

      expect(useCases.removePhoto.execute).toHaveBeenCalledWith({ id: "member-1" });
      expect(revalidatePathMock).toHaveBeenCalledWith("/admin/board");
      expect(revalidatePathMock).toHaveBeenCalledWith("/admin/board/member-1/edit");
    });
  });
});
