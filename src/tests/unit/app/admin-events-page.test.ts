import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { listMock, countsMock } = vi.hoisted(() => ({ listMock: vi.fn(), countsMock: vi.fn() }));

vi.mock("@/interface/admin/events/events-admin-read", () => ({ getAdminEvents: listMock, getAdminEventCounts: countsMock }));
vi.mock("@/interface/admin/events/actions", () => ({ trashEvent: vi.fn(), setEventPublished: vi.fn() }));
vi.mock("@/interface/admin/trash/actions", () => ({ restoreTrashed: vi.fn() }));
vi.mock("@/interface/admin/bulk/actions", () => ({ bulkSetPublished: vi.fn(), bulkTrash: vi.fn() }));

import AdminEventsPage from "../../../../app/admin/events/page";

const event = (index: number, overrides: { date?: string | null; isPublished?: boolean; title?: string } = {}) => ({
  id: `event-${index}`,
  title: overrides.title ?? `Evento ${index}`,
  date: overrides.date === undefined ? "2020-03-01" : overrides.date,
  datePrecision: "day",
  type: "taller",
  commitMessage: null,
  description: null,
  isPublished: overrides.isPublished ?? true,
  updatedAt: new Date("2020-03-02T12:00:00Z"),
  photoCount: 0,
  publishFrom: null,
  publishUntil: null,
});

const render = async (searchParams: Record<string, string> = {}) =>
  renderToStaticMarkup(await AdminEventsPage({ searchParams: Promise.resolve(searchParams) }));

const pastEvents = Array.from({ length: 12 }, (_, index) => event(index));
const draft = event(100, { title: "Borrador nuevo", isPublished: false });
const upcoming = event(101, { title: "Taller futuro", date: "2999-01-01" });

beforeEach(() => {
  listMock.mockReset();
  countsMock.mockReset();
  // More than a handful of rows, so the search and the bulk tools are on.
  listMock.mockResolvedValue([...pastEvents, draft, upcoming]);
  countsMock.mockResolvedValue({ published: 13, draft: 1 });
});

describe("the events list", () => {
  it("has no selection bar before anything is selected", async () => {
    const html = await render({ vista: "pasados" });

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
    const html = await render({ vista: "pasados" });

    expect(html.indexOf('aria-label="Cómo leer la línea"')).toBeGreaterThan(html.lastIndexOf("Evento 11"));
  });
});

describe("the Próximos / Pasados tabs", () => {
  it("opens on Próximos: drafts first, then the upcoming ones, and nothing past", async () => {
    const html = await render();

    expect(html).toContain("Borrador nuevo");
    expect(html).toContain("Taller futuro");
    expect(html.indexOf("Borrador nuevo")).toBeLessThan(html.indexOf("Taller futuro"));
    expect(html).not.toContain("Evento 0");
  });

  it("shows only the past events under ?vista=pasados", async () => {
    const html = await render({ vista: "pasados" });

    expect(html).toContain("Evento 0");
    expect(html).not.toContain("Borrador nuevo");
    expect(html).not.toContain("Taller futuro");
  });

  it("has no «Hoy» line any more", async () => {
    for (const vista of ["proximos", "pasados"]) {
      const html = await render({ vista });

      expect(html).not.toContain('role="separator"');
      expect(html).not.toContain("HEAD → main");
    }
  });

  it("marks the current tab, says how many each holds, and keeps the search and filter but not the page", async () => {
    const html = await render({ vista: "pasados", q: "Evento", estado: "publicados", pagina: "1" });
    const nav = html.slice(html.indexOf('<nav aria-label="Vista de eventos"'), html.indexOf("</nav>", html.indexOf('<nav aria-label="Vista de eventos"')));

    expect(nav).toMatch(/<a[^>]*href="\/admin\/events\?estado=publicados&amp;q=Evento"[^>]*>Próximos<span[^>]*>2<\/span><\/a>/);
    expect(nav).toMatch(/<a aria-current="page"[^>]*href="\/admin\/events\?vista=pasados&amp;estado=publicados&amp;q=Evento"[^>]*>Pasados<span[^>]*>12<\/span><\/a>/);
    expect(nav.match(/aria-current/g) ?? []).toHaveLength(1);
  });

  it("keeps the tab in the status filter, the search form and the pager", async () => {
    listMock.mockResolvedValue(Array.from({ length: 25 }, (_, index) => event(index)));
    const html = await render({ vista: "pasados" });

    expect(html).toContain('href="/admin/events?vista=pasados&amp;estado=borradores"');
    expect(html).toContain('type="hidden" name="vista" value="pasados"');
    expect(html).toContain('href="/admin/events?vista=pasados&amp;pagina=2"');
    expect(html).toContain("Mostrando 1–20 de 25.");
  });

  it("pages each tab on its own rows", async () => {
    listMock.mockResolvedValue([...Array.from({ length: 25 }, (_, index) => event(index)), upcoming]);

    const proximos = await render();
    const pasados = await render({ vista: "pasados", pagina: "2" });

    expect(proximos).toContain("Taller futuro");
    expect(proximos).not.toContain('rel="next"');
    expect(pasados).toContain("Mostrando 21–25 de 25.");
    expect(pasados).not.toContain("Taller futuro");
  });

  it("says when a tab is empty and points to the other one", async () => {
    listMock.mockResolvedValue(pastEvents);
    const proximos = await render();

    expect(proximos).toContain("No hay eventos próximos ni borradores.");
    expect(proximos).toContain('href="/admin/events?vista=pasados"');

    listMock.mockResolvedValue([draft, upcoming]);
    const pasados = await render({ vista: "pasados" });

    expect(pasados).toContain("Todavía no hay eventos pasados.");
    expect(pasados).not.toContain("Borrador nuevo");
  });
});
