import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/interface/admin/media/actions", () => ({ deleteOrphanImages: vi.fn() }));

import { OrphanCleanup, type OrphanItem } from "../../../../app/admin/papelera/imagenes/_components/orphan-cleanup";

const item = (publicId: string, deletable: boolean): OrphanItem => ({ publicId, url: `https://res.cloudinary.com/demo/image/upload/v1/${publicId}.jpg`, width: 800, height: 600, bytes: 2048, uploaded: "1 oct 2026", deletable });
const PAGER = "<nav>Revisar la página siguiente</nav>";
const render = (items: OrphanItem[]) => renderToStaticMarkup(createElement(OrphanCleanup, { items, pager: createElement("nav", null, "Revisar la página siguiente") }));

describe("OrphanCleanup", () => {
  it("offers a checkbox for an old unused image and none for a recent one, which says why", () => {
    const html = render([item("aso/old", true), item("aso/new", false)]);

    expect(html).toContain('aria-label="Seleccionar: aso/old"');
    expect(html).not.toContain('aria-label="Seleccionar: aso/new"');
    expect(html).toContain("menos de 24 horas");
  });

  it("starts with nothing selected and no way to delete yet", () => {
    const html = render([item("aso/old", true)]);

    expect(html).toContain("Nada seleccionado");
    expect(html).not.toContain("Eliminar las seleccionadas");
    expect(html).not.toContain("Sí, eliminar definitivamente");
    expect(html).not.toContain("checked");
  });

  it("disables select-all when nothing on the page can be deleted", () => {
    expect(render([item("aso/new", false)])).toMatch(/<input[^>]*disabled[^>]*>/);
  });

  it("says so when the page has no unused images, and still offers the store's next page", () => {
    const html = render([]);

    expect(html).toContain("No hay imágenes sin uso en esta página.");
    expect(html).toContain(PAGER);
  });

  it("keeps the selection and the store's pager together in the side panel, after the images", () => {
    const html = render([item("aso/old", true)]);
    const panel = html.match(/<aside aria-labelledby="selection-title"[\s\S]*<\/aside>/)?.[0] ?? "";

    expect(panel).toMatch(/<h2[^>]*>Selección<\/h2>/);
    expect(panel).toContain("Seleccionar todas las que se pueden eliminar");
    expect(panel).toContain("Nada seleccionado");
    expect(panel).toContain(PAGER);
    expect(html.indexOf('aria-label="Seleccionar: aso/old"')).toBeLessThan(html.indexOf("<aside"));
  });
});
