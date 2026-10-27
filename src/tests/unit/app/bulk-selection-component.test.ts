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

  it("starts with nothing selected: the select-all box and no action buttons", () => {
    const html = render();

    expect(html).toContain("Seleccionar todo en esta página");
    expect(html).toContain("Nada seleccionado");
    expect(html).not.toContain("Mover a la papelera");
    expect(html).not.toContain("Publicar");
  });

  it("gives every row an unchecked checkbox named after the row", () => {
    const html = render();

    expect(html).toContain('aria-label="Seleccionar: Taller de Git"');
    expect(html).toContain('aria-label="Seleccionar: Charla de Docker"');
    expect(html).not.toContain("checked");
  });

  it("is a labelled region, so assistive tech can find the bar", () => {
    expect(render()).toContain('aria-label="Acciones en lote"');
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
