import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { listMock, countsMock } = vi.hoisted(() => ({ listMock: vi.fn(), countsMock: vi.fn() }));

vi.mock("@/interface/admin/events/events-admin-read", () => ({ getAdminEvents: listMock, getAdminEventCounts: countsMock }));
vi.mock("@/interface/admin/events/actions", () => ({ trashEvent: vi.fn(), setEventPublished: vi.fn() }));
vi.mock("@/interface/admin/trash/actions", () => ({ restoreTrashed: vi.fn() }));
vi.mock("@/interface/admin/bulk/actions", () => ({ bulkSetPublished: vi.fn(), bulkTrash: vi.fn() }));

import AdminEventsPage from "../../../../app/admin/events/page";

const event = (index: number, overrides: { date?: string | null; isPublished?: boolean; title?: string; registrationMode?: string } = {}) => ({
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
  registrationMode: overrides.registrationMode ?? "none",
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

  it("lists the soonest upcoming event first, right after the drafts", async () => {
    const soon = event(102, { title: "Taller pronto", date: "2998-01-01" });
    listMock.mockResolvedValue([upcoming, draft, soon]);
    const html = await render();

    expect(html.indexOf("Borrador nuevo")).toBeLessThan(html.indexOf("Taller pronto"));
    expect(html.indexOf("Taller pronto")).toBeLessThan(html.indexOf("Taller futuro"));
  });

  it("says there are no upcoming events only when the whole tab has none, not when they are on a later page", async () => {
    const drafts = Array.from({ length: 25 }, (_, index) => event(200 + index, { title: `Borrador ${index}`, isPublished: false }));
    const noUpcoming = "Sin eventos próximos. Publique un borrador para verlo aquí.";

    listMock.mockResolvedValue([...drafts, upcoming]);
    expect(await render()).not.toContain(noUpcoming);
    const second = await render({ pagina: "2" });
    expect(second).toContain("Taller futuro");
    expect(second).not.toContain(noUpcoming);

    listMock.mockResolvedValue(drafts);
    expect(await render()).not.toContain(noUpcoming);
    expect(await render({ pagina: "2" })).toContain(noUpcoming);
  });

  it("keeps the tab in the links of the no-results message, merged into one query", async () => {
    listMock.mockResolvedValue([]);
    const html = await render({ vista: "pasados", q: "nada", estado: "publicados" });

    expect(html).toContain("que coincidan con «nada»");
    expect(html).toContain('href="/admin/events?vista=pasados&amp;estado=publicados">Quitar la búsqueda</a>');
    expect(html).not.toMatch(/href="[^"]*\?[^"]*\?/);
  });

  it("tags only the events with registration «Con inscripción» (event-kinds S5), in the same list", async () => {
    listMock.mockResolvedValue([
      event(1, { title: "Fiesta", date: "2999-01-01" }),
      event(2, { title: "Taller UNL", date: "2999-01-02", registrationMode: "unl" }),
      event(3, { title: "Charla abierta", date: "2999-01-03", registrationMode: "open" }),
      // Only a way to sign up earns the tag: anything else the row could carry is not one.
      event(4, { title: "Sin modo", date: "2999-01-04", registrationMode: "" }),
    ]);
    const html = await render();
    const row = (title: string) => html.slice(html.indexOf(`>${title}</a>`), html.indexOf("</li>", html.indexOf(`>${title}</a>`)));

    expect(row("Fiesta")).not.toContain("Con inscripción");
    expect(row("Taller UNL")).toContain("Con inscripción");
    expect(row("Charla abierta")).toContain("Con inscripción");
    expect(row("Sin modo")).not.toContain("Con inscripción");
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
