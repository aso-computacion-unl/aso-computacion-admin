import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/interface/admin/bulk/actions", () => ({ bulkSetPublished: vi.fn(), bulkTrash: vi.fn() }));

import { BulkCheckbox, BulkSelection } from "../../../../app/admin/_components/bulk-selection";

const ITEMS = [
  { id: "a", label: "Taller de Git" },
  { id: "b", label: "Charla de Docker" },
];

describe("BulkSelection", () => {
  const render = () =>
    renderToStaticMarkup(
      createElement(
        BulkSelection,
        { kind: "event", items: ITEMS },
        createElement("ul", null, ITEMS.map((item) => createElement("li", { key: item.id }, createElement(BulkCheckbox, item)))),
      ),
    );

  it("starts with nothing selected and no bar: only the rows, with their checkboxes", () => {
    const html = render();

    expect(html).not.toContain("Seleccionar todo en esta página");
    expect(html).not.toContain("Nada seleccionado");
    expect(html).not.toContain('aria-label="Acciones en lote"');
    expect(html).not.toContain("Mover a la papelera");
    expect(html).not.toContain("Publicar");
    expect(html).toContain("Taller de Git");
  });

  it("gives every row an unchecked checkbox named after the row", () => {
    const html = render();

    expect(html).toContain('aria-label="Seleccionar: Taller de Git"');
    expect(html).toContain('aria-label="Seleccionar: Charla de Docker"');
    expect(html).not.toContain("checked");
  });

  it("renders just the rows when the page has none", () => {
    const html = renderToStaticMarkup(createElement(BulkSelection, { kind: "event", items: [] }, createElement("p", null, "vacío")));

    expect(html).toBe("<p>vacío</p>");
  });
});

describe("BulkCheckbox", () => {
  it("renders nothing outside a selection, so a row works without bulk actions", () => {
    expect(renderToStaticMarkup(createElement(BulkCheckbox, ITEMS[0]!))).toBe("");
  });
});
