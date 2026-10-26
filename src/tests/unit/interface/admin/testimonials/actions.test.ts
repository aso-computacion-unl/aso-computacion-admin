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
    setPhoto: { execute: vi.fn() },
    removePhoto: { execute: vi.fn() },
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("@/interface/auth/require-session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/interface/auth/require-session")>()),
  requireSession: requireSessionMock,
  requireRole: requireSessionMock,
}));
vi.mock("@/interface/admin/testimonials/testimonials-container", () => ({ getTestimonialUseCases: () => useCases }));

import { NotFoundError } from "@/application";
import { ImageTooSmallError, ValidationError } from "@/domain";
import * as actions from "@/interface/admin/testimonials/actions";

function form(fields: Record<string, string | File>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const jpeg = () => new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0])], "a.jpg", { type: "image/jpeg" });
const FIELDS = { quote: "Muy útil.", name: "Ana Pérez", role: "Egresada" };

describe("testimonial server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireSessionMock.mockResolvedValue({ kind: "user", sessionId: "s1", userId: "u1", name: "Ana", role: "ADMIN" });
    useCases.trash.execute.mockResolvedValue({ wasPublished: true });
  });

  it("createTestimonial creates the testimonial, refreshes the list and continues on its edit page (the image needs an id)", async () => {
    useCases.create.execute.mockResolvedValue({ id: "testimonial-1" });

    await expect(actions.createTestimonial(null, form(FIELDS))).rejects.toThrow("REDIRECT");

    expect(useCases.create.execute).toHaveBeenCalledWith({ ...FIELDS, isPublished: false });
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/testimonials");
    expect(redirectMock).toHaveBeenCalledWith("/admin/testimonials/testimonial-1/edit");
  });

  it("uses the testimonial's own length limits in the role message and rejects unknown fields without writing", async () => {
    useCases.create.execute.mockRejectedValue(new ValidationError("role", "too long"));

    expect((await actions.createTestimonial(null, form(FIELDS))).fieldErrors?.role).toContain("80");

    useCases.create.execute.mockClear();
    const unknown = await actions.createTestimonial(null, form({ ...FIELDS, sortOrder: "0" }));

    expect(unknown.fieldErrors?.form).toBeTruthy();
    expect(useCases.create.execute).not.toHaveBeenCalled();
  });

  it("updateTestimonial passes the id, the parsed form and the alt when sent", async () => {
    useCases.update.execute.mockResolvedValue({});

    await expect(actions.updateTestimonial("testimonial-1", null, form({ ...FIELDS, photoAlt: "Charla" }))).resolves.toEqual({ success: true });

    expect(useCases.update.execute).toHaveBeenCalledWith({ id: "testimonial-1", ...FIELDS, photoAlt: "Charla", isPublished: false });
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/testimonials");
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/testimonials/testimonial-1/edit");
  });

  it("publish, trash and move delegate and refresh", async () => {
    await expect(actions.setTestimonialPublished("testimonial-1", true)).resolves.toEqual({ success: true });
    await expect(actions.trashTestimonial("testimonial-1")).resolves.toEqual({ success: true });
    await expect(actions.moveTestimonial("testimonial-1", "down")).resolves.toEqual({ success: true });

    expect(useCases.setPublished.execute).toHaveBeenCalledWith({ id: "testimonial-1", isPublished: true });
    expect(useCases.trash.execute).toHaveBeenCalledWith({ id: "testimonial-1" });
    expect(useCases.move.execute).toHaveBeenCalledWith({ id: "testimonial-1", direction: "down" });
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/testimonials");
  });

  it("moveTestimonial rejects a direction that is not up or down", async () => {
    expect((await actions.moveTestimonial("testimonial-1", "sideways" as "up")).error).toBeTruthy();
    expect(useCases.move.execute).not.toHaveBeenCalled();
  });

  it("maps NotFoundError to a message that names the testimonial", async () => {
    useCases.trash.execute.mockRejectedValue(new NotFoundError("Testimonial not found"));

    expect((await actions.trashTestimonial("gone")).error).toContain("testimonio");
  });

  describe("images", () => {
    it("uploadTestimonialPhoto validates the file, then passes it with the alt", async () => {
      useCases.setPhoto.execute.mockResolvedValue({});

      expect(await actions.uploadTestimonialPhoto("testimonial-1", null, form({ file: jpeg(), photoAlt: "Charla" }))).toEqual({ success: true });

      expect(useCases.setPhoto.execute).toHaveBeenCalledWith({
        id: "testimonial-1",
        file: expect.objectContaining({ name: "a.jpg", type: "image/jpeg" }),
        alt: "Charla",
      });
      expect(revalidatePathMock).toHaveBeenCalledWith("/admin/testimonials/testimonial-1/edit");
    });

    it("rejects a missing file, a wrong type and a spoofed signature before any upload", async () => {
      const noFile = await actions.uploadTestimonialPhoto("testimonial-1", null, form({ photoAlt: "x" }));
      const gif = await actions.uploadTestimonialPhoto("testimonial-1", null, form({ file: new File([new Uint8Array(8)], "a.gif", { type: "image/gif" }), photoAlt: "x" }));
      const spoofed = await actions.uploadTestimonialPhoto("testimonial-1", null, form({ file: new File([new Uint8Array(16)], "a.jpg", { type: "image/jpeg" }), photoAlt: "x" }));

      for (const result of [noFile, gif, spoofed]) {
        expect(result.fieldErrors?.file).toContain("JPEG, PNG o WebP");
      }
      expect(useCases.setPhoto.execute).not.toHaveBeenCalled();
    });

    it("explains the minimum width and the alt rule", async () => {
      useCases.setPhoto.execute.mockRejectedValueOnce(new ImageTooSmallError(1200, 576));
      expect((await actions.uploadTestimonialPhoto("testimonial-1", null, form({ file: jpeg(), photoAlt: "x" }))).fieldErrors?.file).toContain("576");

      useCases.setPhoto.execute.mockRejectedValueOnce(new ValidationError("photoAlt", "required"));
      expect((await actions.uploadTestimonialPhoto("testimonial-1", null, form({ file: jpeg(), photoAlt: "" }))).fieldErrors?.photoAlt).toContain("200");
    });

    it("removeTestimonialPhoto delegates and refreshes the edit page", async () => {
      useCases.removePhoto.execute.mockResolvedValue({});

      expect(await actions.removeTestimonialPhoto("testimonial-1")).toEqual({ success: true });

      expect(useCases.removePhoto.execute).toHaveBeenCalledWith({ id: "testimonial-1" });
      expect(revalidatePathMock).toHaveBeenCalledWith("/admin/testimonials/testimonial-1/edit");
    });
  });
});
