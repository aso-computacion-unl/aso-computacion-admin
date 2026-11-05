import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { pageMock, countsMock } = vi.hoisted(() => ({ pageMock: vi.fn(), countsMock: vi.fn() }));

vi.mock("@/interface/admin/events/events-admin-read", () => ({ getAdminEventsPage: pageMock, getAdminEventCounts: countsMock }));
vi.mock("@/interface/admin/events/actions", () => ({ trashEvent: vi.fn(), setEventPublished: vi.fn() }));
vi.mock("@/interface/admin/trash/actions", () => ({ restoreTrashed: vi.fn() }));
vi.mock("@/interface/admin/bulk/actions", () => ({ bulkSetPublished: vi.fn(), bulkTrash: vi.fn() }));

import AdminEventsPage from "../../../../app/admin/events/page";

const event = (index: number) => ({
  id: `event-${index}`,
  title: `Evento ${index}`,
  date: "2020-03-01",
  datePrecision: "day",
  type: "taller",
  commitMessage: null,
  description: null,
  isPublished: true,
  updatedAt: new Date("2020-03-02T12:00:00Z"),
  photoCount: 0,
  publishFrom: null,
  publishUntil: null,
});

const render = async () => renderToStaticMarkup(await AdminEventsPage({ searchParams: Promise.resolve({}) }));

beforeEach(() => {
  pageMock.mockReset();
  countsMock.mockReset();
  // More than a handful of rows, so the search and the bulk tools are on.
  pageMock.mockResolvedValue({ items: Array.from({ length: 12 }, (_, index) => event(index)), page: 1, pageCount: 1, total: 12 });
  countsMock.mockResolvedValue({ published: 12, draft: 0 });
});

describe("the events list", () => {
  it("has no selection bar before anything is selected", async () => {
    const html = await render();

    expect(html).not.toContain("Nada seleccionado");
    expect(html).not.toContain("Acciones en lote");
    expect(html).toContain('aria-label="Seleccionar: Evento 0"');
  });

  it("puts the search on the same row as the status tabs", async () => {
    const html = await render();
    const tabs = html.indexOf('<nav aria-label="Filtrar por estado"');
    const search = html.indexOf('<form role="search"');
    const between = html.slice(tabs, search);

    expect(tabs).toBeGreaterThan(-1);
    expect(search).toBeGreaterThan(tabs);
    // One flex wrapper opens before the tabs and holds both: nothing closes between the tabs and the search form.
    expect(html.slice(html.lastIndexOf("<div", tabs), tabs)).toMatch(/^<div class="[^"]*\bflex\b[^"]*">$/);
    expect(between.match(/<\/div>/g) ?? []).toHaveLength(0);
  });

  it("shows the legend below the list, not above it", async () => {
    const html = await render();

    expect(html.indexOf('aria-label="Cómo leer la línea"')).toBeGreaterThan(html.lastIndexOf("Evento 11"));
  });
});
