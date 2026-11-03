import { createElement, type ComponentType, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../app/_components/brand-mark", () => ({ BrandLogo: () => null }));

const { sessionMock, libraryMock, trashMock } = vi.hoisted(() => ({ sessionMock: vi.fn(), libraryMock: vi.fn(), trashMock: vi.fn() }));

vi.mock("@/interface/auth/require-page-session", () => ({ requirePageSession: sessionMock }));
vi.mock("@/interface/admin/media/media-admin-read", () => ({ getAdminMediaLibrary: libraryMock }));
vi.mock("@/interface/admin/trash/trash-admin-read", () => ({ getAdminTrash: trashMock }));
vi.mock("@/interface/admin/trash/actions", () => ({ purgeTrashed: vi.fn(), restoreTrashed: vi.fn() }));

import { EmptyState } from "../../../../app/admin/_components/empty-state";
import AdminNotFound from "../../../../app/admin/not-found";
import AdminMediaPage from "../../../../app/admin/medios/page";
import AdminTrashPage from "../../../../app/admin/papelera/page";
import ForumNotFound from "../../../../app/foro/not-found";
import NotFound from "../../../../app/not-found";
import { NotFoundState } from "../../../../app/_components/not-found-state";

/** `createElement` for a component whose `children` are required: the children go in as an argument, not as a prop. */
const withChildren = <P extends { children: ReactNode }>(component: ComponentType<P>, props: Omit<P, "children">, children: ReactNode) =>
  createElement(component as ComponentType<Omit<P, "children">>, props, children);

describe("EmptyState", () => {
  const html = renderToStaticMarkup(withChildren(EmptyState, { icon: "trash", action: createElement("a", { href: "/admin" }, "Volver") }, "La papelera está vacía."));

  it("shows an icon, one sentence and the action, announced as a status", () => {
    expect(html).toContain('data-slot="empty-state"');
    expect(html).toContain("<svg");
    expect(html).toContain("La papelera está vacía.");
    expect(html).toContain('href="/admin"');
    expect(html).toContain('role="status"');
  });

  it("fills the width of its container and centers its content, so a page with nothing to list stays symmetric", () => {
    expect(html).toContain("w-full");
    expect(html).toContain("justify-items-center");
    expect(html).toContain("text-center");
    expect(html).not.toContain("max-w-xl");
  });

  it("is not the dashed block with a coloured left border", () => {
    expect(html).not.toContain("border-l-2");
    expect(html).not.toContain("border-dashed");
  });
});

describe("NotFoundState", () => {
  it("names the problem, says why in one sentence and offers one way back", () => {
    const html = renderToStaticMarkup(withChildren(NotFoundState, { title: "No encontrado", href: "/admin", actionLabel: "Volver al inicio" }, "Ya no existe."));

    expect(html).toContain("No encontrado");
    expect(html).toContain("Ya no existe.");
    expect(html).toContain('href="/admin"');
    expect(html).toContain("Volver al inicio");
    expect(html).toContain('data-slot="not-found-state"');
  });

  it("is centered in the shell it is rendered in", () => {
    const html = renderToStaticMarkup(withChildren(NotFoundState, { title: "A", href: "/", actionLabel: "B" }, "C"));

    expect(html).toContain("mx-auto");
    expect(html).toContain("justify-items-center");
    expect(html).toContain("text-center");
  });

  it("uses the display face in the admin and the forum's own face when asked", () => {
    const admin = renderToStaticMarkup(withChildren(NotFoundState, { title: "A", href: "/", actionLabel: "B" }, "C"));
    const forum = renderToStaticMarkup(withChildren(NotFoundState, { title: "A", href: "/", actionLabel: "B", face: "forum" }, "C"));

    expect(admin).toContain("font-display");
    expect(forum).not.toContain("font-display");
  });
});

describe("the three not-found pages share one state", () => {
  it("renders the admin one inside the admin shell with a way home", () => {
    const html = renderToStaticMarkup(createElement(AdminNotFound));

    expect(html).toContain('data-slot="not-found-state"');
    expect(html).toContain("No encontrado");
    expect(html).toContain('href="/admin"');
  });

  it("renders the forum one with the copy that is true for categories, threads and events", () => {
    const html = renderToStaticMarkup(createElement(ForumNotFound));

    expect(html).toContain('data-slot="not-found-state"');
    expect(html).toContain("Esta página del foro no existe, ya no está disponible o la dirección cambió.");
    expect(html).toContain('href="/foro"');
    expect(html).not.toContain("border-l-2");
    expect(html).not.toContain("font-display");
  });

  it("renders the root one on its own screen, not nested in a shell", () => {
    const html = renderToStaticMarkup(createElement(NotFound));

    expect(html).toContain('data-slot="not-found-state"');
    expect(html).toContain("Página no encontrada");
    expect(html).toContain('href="/admin"');
  });
});

describe("the media library when it cannot be shown", () => {
  beforeEach(() => {
    libraryMock.mockReset();
    sessionMock.mockReset();
  });

  const render = async (role: "ADMIN" | "EDITOR", library: unknown) => {
    sessionMock.mockResolvedValue({ role });
    libraryMock.mockResolvedValue(library);

    return renderToStaticMarkup(await AdminMediaPage({ searchParams: Promise.resolve({}) }));
  };

  it("tells an administrator the image store is not configured", async () => {
    const html = await render("ADMIN", { status: "unavailable" });

    expect(html).toContain("El almacén de imágenes no está configurado en este entorno");
    expect(html).toContain('data-slot="empty-state"');
  });

  it("shows an editor a plain empty state instead of the configuration message", async () => {
    const html = await render("EDITOR", { status: "unavailable" });

    expect(html).not.toContain("configurado");
    expect(html).not.toContain("entorno");
    expect(html).toContain('data-slot="empty-state"');
    expect(html).toContain("Todavía no hay imágenes para mostrar.");
  });

  it("uses the same empty state for an empty library", async () => {
    const html = await render("EDITOR", { status: "ok", items: [], nextCursor: null });

    expect(html).toContain('data-slot="empty-state"');
    expect(html).toContain("Todavía no hay imágenes guardadas.");
  });
});

describe("the trash when it is empty", () => {
  it("uses the shared empty state with a way back", async () => {
    sessionMock.mockResolvedValue({ role: "EDITOR" });
    trashMock.mockResolvedValue([]);

    const html = renderToStaticMarkup(await AdminTrashPage());

    expect(html).toContain('data-slot="empty-state"');
    expect(html).toContain("La papelera está vacía.");
    expect(html).not.toContain("border-l-2");
  });
});
