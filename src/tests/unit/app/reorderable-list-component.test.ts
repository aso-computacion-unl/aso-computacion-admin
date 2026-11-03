import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/interface/admin/reorder/actions", () => ({ reorderContent: vi.fn() }));

import { OrderedRow } from "../../../../app/admin/_components/ordered-row";
import { ReorderableList } from "../../../../app/admin/_components/reorderable-list";

const ITEMS = [
  { id: "a", label: "Primera" },
  { id: "b", label: "Segunda" },
];

const row = (item: { id: string; label: string }, index: number) =>
  createElement(OrderedRow, { key: item.id, id: item.id, published: true, position: index + 1, label: item.label, editHref: `/x/${item.id}`, toggle: null, remove: null }, createElement("h2", null, item.label));

const list = (enabled: boolean, items = ITEMS) =>
  renderToStaticMarkup(createElement(ReorderableList, { kind: "faq", items, offset: 0, total: items.length, enabled, label: "Preguntas" }, items.map(row)));

describe("ReorderableList", () => {
  it("gives every row a drag handle named after it, described for assistive tech", () => {
    const html = list(true);

    expect(html).toContain('aria-label="Arrastrar para reordenar: Primera"');
    expect(html).toContain('aria-label="Arrastrar para reordenar: Segunda"');
    expect(html).toContain('aria-roledescription="elemento reordenable"');
    expect(html).toContain("aria-describedby=");
  });

  it("keeps the rows in the order they were given", () => {
    const html = list(true);

    expect(html.indexOf("Primera")).toBeLessThan(html.indexOf("Segunda"));
    expect(html).toContain('aria-label="Preguntas"');
  });

  it("shows no handles while the list is searched, but still shows the rows", () => {
    const html = list(false);

    expect(html).not.toContain("Arrastrar para reordenar");
    expect(html).toContain("Primera");
  });

  it("drops a child that is not one of the items instead of rendering a hole", () => {
    const html = renderToStaticMarkup(createElement(ReorderableList, { kind: "faq", items: [ITEMS[0]!], offset: 0, total: 1, enabled: true, label: "Preguntas" }, ITEMS.map(row)));

    expect(html).toContain("Primera");
    expect(html).not.toContain("Segunda");
  });
});

describe("OrderedRow", () => {
  it("has no handle outside a reorderable list", () => {
    const html = renderToStaticMarkup(row(ITEMS[0]!, 0));

    expect(html).toContain("Primera");
    expect(html).not.toContain("Arrastrar para reordenar");
  });
});
