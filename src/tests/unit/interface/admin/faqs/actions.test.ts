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
vi.mock("@/interface/admin/faqs/faqs-container", () => ({ getFaqUseCases: () => useCases }));

import { NotFoundError } from "@/application";
import { ValidationError } from "@/domain";
import * as actions from "@/interface/admin/faqs/actions";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe("faq server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminSessionMock.mockResolvedValue(undefined);
  });

  it("createFaq creates the FAQ, refreshes the list and redirects to it", async () => {
    useCases.create.execute.mockResolvedValue({ id: "faq-1" });

    await expect(actions.createFaq(null, form({ question: " ¿Cuesta? ", answer: "No.", isPublished: "on" }))).rejects.toThrow("REDIRECT");

    expect(useCases.create.execute).toHaveBeenCalledWith({ question: "¿Cuesta?", answer: "No.", isPublished: true });
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/faqs");
    expect(redirectMock).toHaveBeenCalledWith("/admin/faqs");
  });

  it("returns Spanish field errors for a domain failure and a malformed form, without writing", async () => {
    useCases.create.execute.mockRejectedValue(new ValidationError("answer", "answer is required"));

    expect((await actions.createFaq(null, form({ question: "q", answer: "" }))).fieldErrors).toEqual({
      answer: expect.stringContaining("respuesta"),
    });

    useCases.create.execute.mockClear();
    const unknown = await actions.createFaq(null, form({ question: "q", answer: "a", sortOrder: "0" }));

    expect(unknown.fieldErrors?.form).toBeTruthy();
    expect(useCases.create.execute).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("updateFaq passes the id and the parsed form", async () => {
    useCases.update.execute.mockResolvedValue({});

    await expect(actions.updateFaq("faq-1", null, form({ question: "q", answer: "a" }))).resolves.toEqual({ success: true });

    expect(useCases.update.execute).toHaveBeenCalledWith({ id: "faq-1", question: "q", answer: "a", isPublished: false });
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/faqs");
  });

  it("setFaqPublished, deleteFaq and moveFaq delegate and refresh the list", async () => {
    await expect(actions.setFaqPublished("faq-1", true)).resolves.toEqual({ success: true });
    await expect(actions.deleteFaq("faq-1")).resolves.toEqual({ success: true });
    await expect(actions.moveFaq("faq-1", "down")).resolves.toEqual({ success: true });

    expect(useCases.setPublished.execute).toHaveBeenCalledWith({ id: "faq-1", isPublished: true });
    expect(useCases.delete.execute).toHaveBeenCalledWith({ id: "faq-1" });
    expect(useCases.move.execute).toHaveBeenCalledWith({ id: "faq-1", direction: "down" });
    expect(revalidatePathMock).toHaveBeenCalledTimes(3);
  });

  it("moveFaq rejects a direction that is not up or down", async () => {
    const result = await actions.moveFaq("faq-1", "sideways" as "up");

    expect(result.error).toBeTruthy();
    expect(useCases.move.execute).not.toHaveBeenCalled();
  });

  it("maps NotFoundError to a message that names the FAQ", async () => {
    useCases.delete.execute.mockRejectedValue(new NotFoundError("Faq not found"));

    expect((await actions.deleteFaq("gone")).error).toContain("pregunta");
  });
});
