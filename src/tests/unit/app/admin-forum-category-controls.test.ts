// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createMock, updateMock, deleteMock, pushMock } = vi.hoisted(() => ({ createMock: vi.fn(), updateMock: vi.fn(), deleteMock: vi.fn(), pushMock: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: pushMock, replace: vi.fn() }) }));
vi.mock("@/interface/admin/forum/actions", () => ({ createForumCategory: createMock, updateForumCategory: updateMock, deleteForumCategory: deleteMock }));

import { CategoryDeleteButton } from "../../../../app/admin/foro/categorias/_components/category-delete-button";
import { CategoryForm } from "../../../../app/admin/foro/categorias/_components/category-form";
import { ToastProvider } from "../../../../app/admin/_components/toast";
import { click, mount, settle, typeInto, unmountAll } from "@/tests/support/dom";

const field = (host: HTMLElement, name: string) => host.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${name}"]`)!;
const button = (host: HTMLElement, text: string) => [...host.querySelectorAll("button")].find((candidate) => candidate.textContent?.includes(text))!;
const inToasts = (children: ReturnType<typeof createElement>) => createElement(ToastProvider, null, children);

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(async () => {
  await unmountAll();
});

describe("the category form", () => {
  it("creates: submits the typed values, then confirms and goes back to the list", async () => {
    createMock.mockResolvedValue({ success: true });
    const host = await mount(inToasts(createElement(CategoryForm, { mode: "create" })));

    await typeInto(field(host, "name"), "Eventos");
    await typeInto(field(host, "description"), "Charlas y talleres");
    await click(button(host, "Crear categoría"));
    await settle();

    const [, formData] = createMock.mock.calls[0] as [unknown, FormData];

    expect(formData.get("name")).toBe("Eventos");
    expect(formData.get("description")).toBe("Charlas y talleres");
    expect(formData.get("slug")).toBe("");
    expect(pushMock).toHaveBeenCalledWith("/admin/foro/categorias");
    expect(document.body.textContent).toContain("Categoría creada.");
  });

  it("shows the server's message next to the field and stays on the page", async () => {
    createMock.mockResolvedValue({ fieldErrors: { name: "El nombre es obligatorio y admite hasta 60 caracteres." } });
    const host = await mount(inToasts(createElement(CategoryForm, { mode: "create" })));

    await click(button(host, "Crear categoría"));
    await settle();

    expect(host.textContent).toContain("El nombre es obligatorio y admite hasta 60 caracteres.");
    expect(field(host, "name").getAttribute("aria-invalid")).toBe("true");
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("edits: starts from the category, saves for its id and says the changes were saved without leaving", async () => {
    updateMock.mockResolvedValue({ success: true });
    const host = await mount(inToasts(createElement(CategoryForm, { mode: "edit", id: "c1", initialValues: { name: "Programación", description: "Código", slug: "programacion" } })));

    expect(field(host, "name").value).toBe("Programación");
    expect(field(host, "slug").value).toBe("programacion");

    await typeInto(field(host, "name"), "Código");
    await click(button(host, "Guardar cambios"));
    await settle();

    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(updateMock.mock.calls[0]![0]).toBe("c1");
    expect((updateMock.mock.calls[0]![2] as FormData).get("name")).toBe("Código");
    expect(host.textContent).toContain("Cambios guardados.");
    expect(pushMock).not.toHaveBeenCalled();
  });
});

describe("the category delete button", () => {
  it("asks first, deletes on confirmation and toasts the result", async () => {
    deleteMock.mockResolvedValue({ success: true });
    const host = await mount(inToasts(createElement(CategoryDeleteButton, { id: "c1", name: "Programación" })));

    expect(deleteMock).not.toHaveBeenCalled();
    await click(button(host, "Eliminar"));
    expect(host.textContent).toContain("No se puede deshacer");
    await click(button(host, "Sí, eliminar"));
    await settle();

    expect(deleteMock).toHaveBeenCalledWith("c1");
    expect(document.body.textContent).toContain("Categoría eliminada.");
  });

  it("shows the refusal on the row when the category still has threads", async () => {
    deleteMock.mockResolvedValue({ error: "La categoría todavía tiene hilos y no se puede eliminar." });
    const host = await mount(inToasts(createElement(CategoryDeleteButton, { id: "c1", name: "Programación" })));

    await click(button(host, "Eliminar"));
    await click(button(host, "Sí, eliminar"));
    await settle();

    expect(host.textContent).toContain("La categoría todavía tiene hilos y no se puede eliminar.");
    expect(document.body.textContent).not.toContain("Categoría eliminada.");
  });
});
