import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FilterEmpty, StatusFilter } from "../../../../app/admin/_components/status-filter";

const COUNTS = { published: 3, draft: 2 };

describe("StatusFilter", () => {
  const render = (current: "todos" | "publicados" | "borradores") =>
    renderToStaticMarkup(createElement(StatusFilter, { path: "/admin/news", current, counts: COUNTS }));

  it("links each option to the list with ?estado=, so the server does the filtering", () => {
    const html = render("todos");

    expect(html).toContain('href="/admin/news"');
    expect(html).toContain('href="/admin/news?estado=publicados"');
    expect(html).toContain('href="/admin/news?estado=borradores"');
  });

  it("shows each option's count: all, published and drafts", () => {
    const html = render("todos");

    expect(html).toMatch(/Todos<span[^>]*>5</);
    expect(html).toMatch(/Publicados<span[^>]*>3</);
    expect(html).toMatch(/Borradores<span[^>]*>2</);
  });

  it("marks only the current option", () => {
    const html = render("borradores");

    expect(html.match(/aria-current="true"/g)).toHaveLength(1);
    expect(html).toMatch(/aria-current="true"[^>]*>Borradores/);
  });

  it("is a labelled navigation", () => {
    expect(render("todos")).toContain('aria-label="Filtrar por estado"');
  });
});

describe("FilterEmpty", () => {
  it("says which state has nothing and links back to the whole list", () => {
    const published = renderToStaticMarkup(createElement(FilterEmpty, { path: "/admin/events", filter: "publicados", noun: "eventos" }));
    const drafts = renderToStaticMarkup(createElement(FilterEmpty, { path: "/admin/events", filter: "borradores", noun: "eventos" }));

    expect(published).toContain("No hay eventos publicados.");
    expect(drafts).toContain("No hay eventos en borrador.");
    expect(drafts).toContain('href="/admin/events"');
  });
});
