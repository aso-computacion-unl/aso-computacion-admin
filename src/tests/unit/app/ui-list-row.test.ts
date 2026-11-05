import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const reads = vi.hoisted(() => ({
  faqsPage: vi.fn(),
  faqsCounts: vi.fn(),
  board: vi.fn(),
  eventsPage: vi.fn(),
  eventsCounts: vi.fn(),
  newsPage: vi.fn(),
  newsCounts: vi.fn(),
}));
const actions = vi.hoisted(() => (...names: string[]) => Object.fromEntries(names.map((name) => [name, vi.fn()])));

vi.mock("@/interface/admin/faqs/faqs-admin-read", () => ({ getAdminFaqsPage: reads.faqsPage, getAdminFaqsCounts: reads.faqsCounts }));
vi.mock("@/interface/admin/board/board-members-admin-read", () => ({ getAdminBoardMembers: reads.board }));
vi.mock("@/interface/admin/events/events-admin-read", () => ({ getAdminEventsPage: reads.eventsPage, getAdminEventCounts: reads.eventsCounts }));
vi.mock("@/interface/admin/news/news-admin-read", () => ({ getAdminNewsPage: reads.newsPage, getAdminNewsCounts: reads.newsCounts }));
vi.mock("@/interface/admin/faqs/actions", () => actions("trashFaq", "moveFaq", "setFaqPublished"));
vi.mock("@/interface/admin/board/actions", () => actions("trashBoardMember", "moveBoardMember", "setBoardMemberPublished"));
vi.mock("@/interface/admin/events/actions", () => actions("trashEvent", "setEventPublished"));
vi.mock("@/interface/admin/news/actions", () => actions("trashNewsItem", "setNewsItemPublished"));
vi.mock("@/interface/admin/trash/actions", () => actions("restoreTrashed"));
vi.mock("@/interface/admin/bulk/actions", () => actions("bulkSetPublished", "bulkTrash"));
vi.mock("@/interface/admin/reorder/actions", () => actions("reorderContent"));

import { ListRow } from "../../../../app/admin/_components/list-row";
import AdminBoardPage from "../../../../app/admin/board/page";
import AdminEventsPage from "../../../../app/admin/events/page";
import AdminFaqsPage from "../../../../app/admin/faqs/page";
import AdminNewsPage from "../../../../app/admin/news/page";
import { TrashButton } from "../../../../app/admin/_components/row-actions";

const faq = (index: number) => ({ id: `faq-${index}`, question: `Pregunta ${index}`, answer: "Respuesta", command: null, isPublished: true });
const event = (index: number) => ({
  id: `event-${index}`,
  title: `Evento ${index}`,
  slug: `evento-${index}`,
  date: "2099-01-01",
  datePrecision: "day",
  type: "taller",
  commitMessage: "feat: algo",
  description: "Una descripción",
  isPublished: true,
  photoCount: 0,
  publishAt: null,
  unpublishAt: null,
});
const newsItem = (index: number) => ({ id: `news-${index}`, title: `Noticia ${index}`, summary: "Resumen", publishedAt: "2026-01-01", cover: null, isPublished: true, publishAt: null, unpublishAt: null });
const member = (index: number) => ({ id: `member-${index}`, name: `Integrante ${index}`, role: "Vocal", isPublished: true, photo: null });
const pageOf = <T>(items: T[]) => ({ items, total: items.length, page: 1, pageSize: 20, pageCount: 1 });
const counts = (n: number) => ({ published: n, draft: 0 });
const params = (search: Record<string, string> = {}) => ({ searchParams: Promise.resolve(search) });

beforeEach(() => {
  for (const read of Object.values(reads)) read.mockReset();
});

describe("ListRow", () => {
  const html = renderToStaticMarkup(
    createElement(
      ListRow,
      {
        id: "a",
        label: "Pregunta",
        published: true,
        lead: createElement("span", null, "LEAD"),
        toggle: createElement("button", null, "TOGGLE"),
        remove: createElement("button", null, "REMOVE"),
        editHref: "/admin/faqs/a/edit",
      },
      createElement("h2", null, "TITLE"),
    ),
  );

  it("has one anatomy: lead, title, then the publish toggle, Editar and the removal in one actions area", () => {
    const order = ["LEAD", "TITLE", "TOGGLE", "Editar", "REMOVE"].map((part) => html.indexOf(part));

    expect(order.every((position) => position >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(html).toContain('data-slot="list-row"');
    expect(html).toContain('aria-label="Editar: Pregunta"');
  });
});

describe("the trash button of a row", () => {
  it("shows an icon, never the long label, so it cannot overflow the card; the name stays for assistive tech", () => {
    const html = renderToStaticMarkup(createElement(TrashButton, { label: "Hackathon", warning: "¿Mover?", action: vi.fn() }));

    expect(html).toContain('aria-label="Mover a la papelera: Hackathon"');
    expect(html).toMatch(/<span class="sr-only">Mover a la papelera<\/span>/);
  });
});

describe("a short list", () => {
  it("drops the row checkboxes and the search under five rows and ends with an Agregar row", async () => {
    reads.faqsPage.mockResolvedValue(pageOf([faq(1), faq(2), faq(3)]));
    reads.faqsCounts.mockResolvedValue(counts(3));

    const html = renderToStaticMarkup(await AdminFaqsPage(params()));

    expect(html).toContain("Pregunta 3");
    expect(html).not.toContain('role="search"');
    expect(html).not.toContain('aria-label="Seleccionar:');
    expect(html).toContain('data-slot="add-row"');
    expect(html).toContain('href="/admin/faqs/new"');
    expect(html).toContain("Agregar pregunta");
  });

  it("keeps the tools from five rows on, and then needs no Agregar row", async () => {
    const faqs = [1, 2, 3, 4, 5].map(faq);

    reads.faqsPage.mockResolvedValue(pageOf(faqs));
    reads.faqsCounts.mockResolvedValue(counts(5));

    const html = renderToStaticMarkup(await AdminFaqsPage(params()));

    expect(html).toContain('role="search"');
    expect(html).toContain('aria-label="Seleccionar: Pregunta 1"');
    expect(html).not.toContain('data-slot="add-row"');
  });

  it("keeps the search while a search is in force, even when few rows match", async () => {
    reads.faqsPage.mockResolvedValue(pageOf([faq(1)]));
    reads.faqsCounts.mockResolvedValue(counts(30));

    const html = renderToStaticMarkup(await AdminFaqsPage(params({ q: "pregunta" })));

    expect(html).toContain('role="search"');
    expect(html).not.toContain('data-slot="add-row"');
  });

  it("applies to a list without a search too (the board)", async () => {
    reads.board.mockResolvedValue([member(1), member(2)]);

    const html = renderToStaticMarkup(await AdminBoardPage());

    expect(html).not.toContain('aria-label="Seleccionar:');
    expect(html).toContain('data-slot="add-row"');
    expect(html).toContain('href="/admin/board/new"');
    expect(html).toContain("Agregar integrante");
  });

  it("applies to the events timeline", async () => {
    reads.eventsPage.mockResolvedValue(pageOf([event(1), event(2)]));
    reads.eventsCounts.mockResolvedValue(counts(2));

    const html = renderToStaticMarkup(await AdminEventsPage(params()));

    expect(html).toContain("Evento 2");
    expect(html).not.toContain('role="search"');
    expect(html).not.toContain("Seleccionar todo");
    expect(html).toContain('href="/admin/events/new"');
    expect(html).toContain("Agregar evento");
    expect(html).toContain('data-slot="list-row"');
  });

  it("applies to the news list", async () => {
    reads.newsPage.mockResolvedValue(pageOf([newsItem(1)]));
    reads.newsCounts.mockResolvedValue(counts(1));

    const html = renderToStaticMarkup(await AdminNewsPage(params()));

    expect(html).not.toContain('role="search"');
    expect(html).toContain("Agregar noticia");
    expect(html).toContain('data-slot="list-row"');
  });
});
