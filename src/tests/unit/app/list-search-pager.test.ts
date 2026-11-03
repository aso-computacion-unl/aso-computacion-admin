import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ListSearch } from "../../../../app/admin/_components/list-search";
import { Pager } from "../../../../app/admin/_components/pager";
import { FilterEmpty, StatusFilter } from "../../../../app/admin/_components/status-filter";

const render = (element: ReturnType<typeof createElement>) => renderToStaticMarkup(element);
const page = (overrides: Partial<{ page: number; pageCount: number; total: number; pageSize: number }> = {}) => ({
  items: [],
  page: 1,
  pageCount: 3,
  total: 45,
  pageSize: 20,
  ...overrides,
});

describe("ListSearch", () => {
  const search = (props: Partial<Parameters<typeof ListSearch>[0]> = {}) =>
    render(createElement(ListSearch, { path: "/admin/news", filter: "todos", search: "", label: "novedades", ...props }));

  it("is a GET form on the list, so a search is a shareable URL and works without scripts", () => {
    const html = search();

    expect(html).toContain('method="get"');
    expect(html).toContain('action="/admin/news"');
    expect(html).toContain('role="search"');
    expect(html).toContain('name="q"');
  });

  it("is labelled and bounded to the maximum search length", () => {
    const html = search();

    expect(html).toContain("Buscar en novedades");
    expect(html).toContain('maxLength="80"');
  });

  it("keeps the status filter in the form, and shows the current text with a way to clear it", () => {
    const html = search({ filter: "borradores", search: "git" });

    expect(html).toContain('type="hidden" name="estado" value="borradores"');
    expect(html).toContain('value="git"');
    expect(html).toContain('href="/admin/news?estado=borradores"');
  });

  it("has no hidden filter and no clear link on the plain list", () => {
    const html = search();

    expect(html).not.toContain('name="estado"');
    expect(html).not.toContain("Quitar búsqueda");
  });
});

describe("Pager", () => {
  const pager = (props: Partial<Parameters<typeof Pager>[0]> = {}) =>
    render(createElement(Pager, { path: "/admin/news", filter: "todos", search: "", page: page(), ...props }));

  it("links the previous and next pages with the filter and search carried along", () => {
    const html = pager({ filter: "publicados", search: "git", page: page({ page: 2 }) });

    expect(html).toContain('href="/admin/news?estado=publicados&amp;q=git"');
    expect(html).toContain('href="/admin/news?estado=publicados&amp;q=git&amp;pagina=3"');
    expect(html).toContain('rel="prev"');
    expect(html).toContain('rel="next"');
  });

  it("makes page 1 the bare URL when going back to it", () => {
    expect(pager({ page: page({ page: 2 }) })).toContain('href="/admin/news"');
  });

  it("disables the previous link on the first page and the next one on the last", () => {
    const first = pager({ page: page({ page: 1 }) });
    const last = pager({ page: page({ page: 3 }) });

    expect(first).not.toContain('rel="prev"');
    expect(first).toMatch(/aria-disabled="true"[^>]*>Anterior/);
    expect(last).not.toContain('rel="next"');
    expect(last).toMatch(/aria-disabled="true"[^>]*>Siguiente/);
  });

  it("says which rows are shown out of how many, and the page out of how many pages", () => {
    const html = pager({ page: page({ page: 3, total: 45 }) });

    expect(html).toContain("41–45 de 45");
    expect(html).toContain("Página 3 de 3");
  });

  it("renders nothing for a single page without a search", () => {
    expect(pager({ page: page({ pageCount: 1, total: 7 }) })).toBe("");
  });

  it("states the number of results of a search even on a single page", () => {
    expect(pager({ search: "git", page: page({ pageCount: 1, total: 1 }) })).toContain("1 resultado para «git»");
    expect(pager({ search: "git", page: page({ pageCount: 1, total: 4 }) })).toContain("4 resultados para «git»");
  });

  it("is a labelled navigation", () => {
    expect(pager()).toContain('aria-label="Paginación"');
  });
});

describe("StatusFilter with a search", () => {
  it("keeps the search in every option and goes back to the first page", () => {
    const html = render(createElement(StatusFilter, { path: "/admin/news", current: "todos", counts: { published: 1, draft: 1 }, search: "git" }));

    expect(html).toContain('href="/admin/news?q=git"');
    expect(html).toContain('href="/admin/news?estado=publicados&amp;q=git"');
  });
});

describe("FilterEmpty with a search", () => {
  it("names the search and offers to drop it, keeping the filter", () => {
    const html = render(createElement(FilterEmpty, { path: "/admin/events", filter: "publicados", noun: "eventos", search: "zzz" }));

    expect(html).toContain("No hay eventos publicados que coincidan con «zzz».");
    expect(html).toContain('href="/admin/events?estado=publicados"');
    expect(html).toContain("Quitar la búsqueda");
  });

  it("with no filter, only the search is dropped", () => {
    const html = render(createElement(FilterEmpty, { path: "/admin/events", filter: "todos", noun: "eventos", search: "zzz" }));

    expect(html).toContain("No hay eventos que coincidan con «zzz».");
    expect(html).toContain('href="/admin/events"');
  });
});
