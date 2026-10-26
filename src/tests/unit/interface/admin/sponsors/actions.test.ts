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
    setLogo: { execute: vi.fn() },
    removeLogo: { execute: vi.fn() },
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("@/interface/auth/require-session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/interface/auth/require-session")>()),
  requireSession: requireSessionMock,
  requireRole: requireSessionMock,
}));
vi.mock("@/interface/admin/sponsors/sponsors-container", () => ({ getSponsorUseCases: () => useCases }));

import { NotFoundError } from "@/application";
import { ImageTooSmallError, ValidationError } from "@/domain";
import * as actions from "@/interface/admin/sponsors/actions";

function form(fields: Record<string, string | File>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const jpeg = () => new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0])], "a.jpg", { type: "image/jpeg" });
const FIELDS = { name: "Acme", url: "https://acme.test" };

describe("sponsor server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireSessionMock.mockResolvedValue({ kind: "user", sessionId: "s1", userId: "u1", name: "Ana", role: "ADMIN" });
    useCases.trash.execute.mockResolvedValue({ wasPublished: true });
  });

  it("createSponsor creates the sponsor, refreshes the list and continues on its edit page (the image needs an id)", async () => {
    useCases.create.execute.mockResolvedValue({ id: "sponsor-1" });

    await expect(actions.createSponsor(null, form(FIELDS))).rejects.toThrow("REDIRECT");

    expect(useCases.create.execute).toHaveBeenCalledWith({ ...FIELDS, isPublished: false });
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/sponsors");
    expect(redirectMock).toHaveBeenCalledWith("/admin/sponsors/sponsor-1/edit");
  });

  it("uses the sponsor's own length limits in the link message and rejects unknown fields without writing", async () => {
    useCases.create.execute.mockRejectedValue(new ValidationError("url", "too long"));

    expect((await actions.createSponsor(null, form(FIELDS))).fieldErrors?.url).toContain("300");

    useCases.create.execute.mockClear();
    const unknown = await actions.createSponsor(null, form({ ...FIELDS, sortOrder: "0" }));

    expect(unknown.fieldErrors?.form).toBeTruthy();
    expect(useCases.create.execute).not.toHaveBeenCalled();
  });

  it("updateSponsor passes the id, the parsed form and the alt when sent", async () => {
    useCases.update.execute.mockResolvedValue({});

    await expect(actions.updateSponsor("sponsor-1", null, form({ ...FIELDS, logoAlt: "Charla" }))).resolves.toEqual({ success: true });

    expect(useCases.update.execute).toHaveBeenCalledWith({ id: "sponsor-1", ...FIELDS, logoAlt: "Charla", isPublished: false });
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/sponsors");
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/sponsors/sponsor-1/edit");
  });

  it("publish, trash and move delegate and refresh", async () => {
    await expect(actions.setSponsorPublished("sponsor-1", true)).resolves.toEqual({ success: true });
    await expect(actions.trashSponsor("sponsor-1")).resolves.toEqual({ success: true });
    await expect(actions.moveSponsor("sponsor-1", "down")).resolves.toEqual({ success: true });

    expect(useCases.setPublished.execute).toHaveBeenCalledWith({ id: "sponsor-1", isPublished: true });
    expect(useCases.trash.execute).toHaveBeenCalledWith({ id: "sponsor-1" });
    expect(useCases.move.execute).toHaveBeenCalledWith({ id: "sponsor-1", direction: "down" });
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/sponsors");
  });

  it("moveSponsor rejects a direction that is not up or down", async () => {
    expect((await actions.moveSponsor("sponsor-1", "sideways" as "up")).error).toBeTruthy();
    expect(useCases.move.execute).not.toHaveBeenCalled();
  });

  it("maps NotFoundError to a message that names the sponsor", async () => {
    useCases.trash.execute.mockRejectedValue(new NotFoundError("Sponsor not found"));

    expect((await actions.trashSponsor("gone")).error).toContain("aliado");
  });

  describe("images", () => {
    it("uploadSponsorLogo validates the file, then passes it with the alt", async () => {
      useCases.setLogo.execute.mockResolvedValue({});

      expect(await actions.uploadSponsorLogo("sponsor-1", null, form({ file: jpeg(), logoAlt: "Charla" }))).toEqual({ success: true });

      expect(useCases.setLogo.execute).toHaveBeenCalledWith({
        id: "sponsor-1",
        file: expect.objectContaining({ name: "a.jpg", type: "image/jpeg" }),
        alt: "Charla",
      });
      expect(revalidatePathMock).toHaveBeenCalledWith("/admin/sponsors/sponsor-1/edit");
    });

    it("rejects a missing file, a wrong type and a spoofed signature before any upload", async () => {
      const noFile = await actions.uploadSponsorLogo("sponsor-1", null, form({ logoAlt: "x" }));
      const gif = await actions.uploadSponsorLogo("sponsor-1", null, form({ file: new File([new Uint8Array(8)], "a.gif", { type: "image/gif" }), logoAlt: "x" }));
      const spoofed = await actions.uploadSponsorLogo("sponsor-1", null, form({ file: new File([new Uint8Array(16)], "a.jpg", { type: "image/jpeg" }), logoAlt: "x" }));

      for (const result of [noFile, gif, spoofed]) {
        expect(result.fieldErrors?.file).toContain("JPEG, PNG o WebP");
      }
      expect(useCases.setLogo.execute).not.toHaveBeenCalled();
    });

    it("explains the minimum width and the alt rule", async () => {
      useCases.setLogo.execute.mockRejectedValueOnce(new ImageTooSmallError(1200, 576));
      expect((await actions.uploadSponsorLogo("sponsor-1", null, form({ file: jpeg(), logoAlt: "x" }))).fieldErrors?.file).toContain("576");

      useCases.setLogo.execute.mockRejectedValueOnce(new ValidationError("logoAlt", "required"));
      expect((await actions.uploadSponsorLogo("sponsor-1", null, form({ file: jpeg(), logoAlt: "" }))).fieldErrors?.logoAlt).toContain("200");
    });

    it("removeSponsorLogo delegates and refreshes the edit page", async () => {
      useCases.removeLogo.execute.mockResolvedValue({});

      expect(await actions.removeSponsorLogo("sponsor-1")).toEqual({ success: true });

      expect(useCases.removeLogo.execute).toHaveBeenCalledWith({ id: "sponsor-1" });
      expect(revalidatePathMock).toHaveBeenCalledWith("/admin/sponsors/sponsor-1/edit");
    });
  });
});
