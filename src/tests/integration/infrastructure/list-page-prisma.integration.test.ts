import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { ListCriteria, Page, PageableRepository } from "@/application/ports/list-criteria";
import { Event } from "@/domain/event";
import { Faq } from "@/domain/faq";
import { NewsItem } from "@/domain/news-item";
import { TerminalCommand } from "@/domain/terminal-command";
import { EventPrismaRepository } from "@/infrastructure/repositories/event-prisma.repository";
import { FaqPrismaRepository } from "@/infrastructure/repositories/faq-prisma.repository";
import { NewsPrismaRepository } from "@/infrastructure/repositories/news-prisma.repository";
import { TerminalCommandPrismaRepository } from "@/infrastructure/repositories/terminal-command-prisma.repository";

const events = new EventPrismaRepository();
const news = new NewsPrismaRepository();
const faqs = new FaqPrismaRepository();
const commands = new TerminalCommandPrismaRepository();

const FULL_PAGE = { page: 1, pageSize: 20 };
const idsOf = <E extends { props: { id: string } }>(page: Page<E>) => page.items.map((item) => item.props.id);

/** Every page of a list, walked from the first to the last: the way an admin pages through it. */
async function walk<E extends { props: { id: string } }>(repository: PageableRepository<E>, criteria: ListCriteria = {}, pageSize = 4) {
  const first = await repository.listPage(criteria, { page: 1, pageSize });
  const pages = [first];

  for (let page = 2; page <= first.pageCount; page += 1) pages.push(await repository.listPage(criteria, { page, pageSize }));

  return pages;
}

describe("events: search and pages (integration)", () => {
  it("matches title, description, place and commit message regardless of case, and nothing else", async () => {
    const byTitle = await events.create(Event.create({ title: "Taller de Git" }));
    const byDescription = await events.create(Event.create({ title: "A", description: "Aprenda GIT desde cero" }));
    const byPlace = await events.create(Event.create({ title: "B", lugar: "Aula git-lab" }));
    const byCommit = await events.create(Event.create({ title: "C", commitMessage: "feat: git rebase" }));
    await events.create(Event.create({ title: "Charla de Docker" }));

    const page = await events.listPage({ search: "git" }, FULL_PAGE);

    expect(new Set(idsOf(page))).toEqual(new Set([byTitle, byDescription, byPlace, byCommit].map((event) => event.props.id)));
    expect(page.total).toBe(4);
  });

  it("treats %, _ and a backslash as plain characters", async () => {
    const percent = await events.create(Event.create({ title: "Descuento del 100% para socios" }));
    const underscore = await events.create(Event.create({ title: "git_hooks en vivo" }));
    await events.create(Event.create({ title: "Sin símbolos" }));
    await events.create(Event.create({ title: "gitXhooks" }));

    expect(idsOf(await events.listPage({ search: "%" }, FULL_PAGE))).toEqual([percent.props.id]);
    expect(idsOf(await events.listPage({ search: "git_hooks" }, FULL_PAGE))).toEqual([underscore.props.id]);
    expect(idsOf(await events.listPage({ search: "\\" }, FULL_PAGE))).toEqual([]);
  });

  it("composes search with the status filter and never shows trashed rows", async () => {
    const published = await events.create(Event.create({ title: "Taller publicado", isPublished: true }));
    const draft = await events.create(Event.create({ title: "Taller borrador" }));
    const trashed = await events.create(Event.create({ title: "Taller en la papelera" }));
    await events.trash(trashed.props.id);

    expect(idsOf(await events.listPage({ search: "taller", status: "published" }, FULL_PAGE))).toEqual([published.props.id]);
    expect(idsOf(await events.listPage({ search: "taller", status: "draft" }, FULL_PAGE))).toEqual([draft.props.id]);
    expect((await events.listPage({ search: "taller" }, FULL_PAGE)).total).toBe(2);
  });

  it("pages in a stable order: every row exactly once, even when dates and creation times are equal", async () => {
    const created = await Promise.all(Array.from({ length: 11 }, (_, index) => events.create(Event.create({ title: `Evento ${index}`, date: "2026-05-01" }))));

    const pages = await walk(events);
    const seen = pages.flatMap((page) => idsOf(page));

    expect(pages.map((page) => page.items.length)).toEqual([4, 4, 3]);
    expect(pages.every((page) => page.total === 11 && page.pageCount === 3)).toBe(true);
    expect(new Set(seen).size).toBe(11);
    expect(new Set(seen)).toEqual(new Set(created.map((event) => event.props.id)));
    expect(idsOf(await events.listPage({}, { page: 2, pageSize: 4 }))).toEqual(idsOf(pages[1]!));
  });

  it("lists in the same order as list(), so a page is a window of the whole list", async () => {
    await events.create(Event.create({ title: "Viejo", date: "2025-01-10" }));
    await events.create(Event.create({ title: "Próximo", date: "2026-12-01" }));
    await events.create(Event.create({ title: "Sin fecha" }));

    const whole = (await events.list()).map((event) => event.props.id);

    expect((await walk(events, {}, 2)).flatMap((page) => idsOf(page))).toEqual(whole);
  });

  it("clamps a page past the end to the last one", async () => {
    await Promise.all(Array.from({ length: 5 }, (_, index) => events.create(Event.create({ title: `Evento ${index}` }))));

    const page = await events.listPage({}, { page: 40, pageSize: 4 });

    expect(page).toMatchObject({ page: 2, pageCount: 2, total: 5 });
    expect(page.items).toHaveLength(1);
  });
});

describe("news: search and pages (integration)", () => {
  const make = (title: string, overrides: Partial<Parameters<typeof NewsItem.create>[0]> = {}) =>
    NewsItem.create({ title, summary: "Resumen", body: "Cuerpo", publishedAt: "2026-05-01", ...overrides });

  it("matches title, summary and body regardless of case", async () => {
    const byTitle = await news.create(make("Nuevo Laboratorio"));
    const bySummary = await news.create(make("A", { summary: "Se inaugura el laboratorio" }));
    const byBody = await news.create(make("B", { body: "Visite el LABORATORIO 2" }));
    await news.create(make("Otra cosa"));

    const page = await news.listPage({ search: "laboratorio" }, FULL_PAGE);

    expect(new Set(idsOf(page))).toEqual(new Set([byTitle, bySummary, byBody].map((item) => item.props.id)));
  });

  it("composes search with status, hides the trash and treats % as text", async () => {
    const published = await news.create(make("Beca del 50%", { isPublished: true }));
    await news.create(make("Beca borrador"));
    const trashed = await news.create(make("Beca vieja"));
    await news.trash(trashed.props.id);

    expect(idsOf(await news.listPage({ search: "beca", status: "published" }, FULL_PAGE))).toEqual([published.props.id]);
    expect(idsOf(await news.listPage({ search: "50%" }, FULL_PAGE))).toEqual([published.props.id]);
    expect((await news.listPage({ search: "beca" }, FULL_PAGE)).total).toBe(2);
  });

  it("pages every row exactly once in the order of list()", async () => {
    await Promise.all(Array.from({ length: 9 }, (_, index) => news.create(make(`Noticia ${index}`, { publishedAt: index % 2 ? "2026-05-01" : "2026-04-01" }))));

    const whole = (await news.list()).map((item) => item.props.id);
    const pages = await walk(news, {}, 4);

    expect(pages.flatMap((page) => idsOf(page))).toEqual(whole);
    expect(pages[0]).toMatchObject({ total: 9, pageCount: 3 });
  });
});

describe("FAQs: search and pages (integration)", () => {
  const make = (index: number, overrides: Partial<Parameters<typeof Faq.create>[0]> = {}) =>
    Faq.create({ question: `¿Pregunta ${index}?`, answer: "Respuesta", sortOrder: index, ...overrides });

  it("matches question, answer and command regardless of case", async () => {
    const byQuestion = await faqs.create(make(0, { question: "¿Cuánto cuesta la MEMBRESÍA?" }));
    const byAnswer = await faqs.create(make(1, { answer: "La membresía es gratuita" }));
    const byCommand = await faqs.create(make(2, { command: "membresia" }));
    await faqs.create(make(3));

    expect(new Set(idsOf(await faqs.listPage({ search: "membresía" }, FULL_PAGE)))).toEqual(new Set([byQuestion, byAnswer].map((item) => item.props.id)));
    expect(idsOf(await faqs.listPage({ search: "MEMBRESIA" }, FULL_PAGE))).toEqual([byCommand.props.id]);
  });

  it("pages in display order with every row once, and hides the trash", async () => {
    const created = await Promise.all(Array.from({ length: 7 }, (_, index) => faqs.create(make(index))));
    await faqs.trash(created[3]!.props.id);

    const whole = (await faqs.list()).map((item) => item.props.id);
    const pages = await walk(faqs, {}, 3);

    expect(pages.flatMap((page) => idsOf(page))).toEqual(whole);
    expect(whole).toHaveLength(6);
    expect(pages[0]).toMatchObject({ total: 6, pageCount: 2 });
  });
});

describe("terminal commands: search and pages (integration)", () => {
  const make = (index: number, overrides: Partial<Parameters<typeof TerminalCommand.create>[0]> = {}) =>
    TerminalCommand.create({ command: `cmd${index}`, description: "Descripción", output: "salida", sortOrder: index, ...overrides });

  it("matches command, description and output regardless of case", async () => {
    const byCommand = await commands.create(make(0, { command: "sudoku" }));
    const byDescription = await commands.create(make(1, { description: "Juega al SUDOKU" }));
    const byOutput = await commands.create(make(2, { output: "un sudoku fácil" }));
    await commands.create(make(3));

    expect(new Set(idsOf(await commands.listPage({ search: "sudoku" }, FULL_PAGE)))).toEqual(
      new Set([byCommand, byDescription, byOutput].map((item) => item.props.id)),
    );
  });

  it("pages in display order with every row once", async () => {
    await Promise.all(Array.from({ length: 5 }, (_, index) => commands.create(make(index))));

    const whole = (await commands.list()).map((item) => item.props.id);

    expect((await walk(commands, {}, 2)).flatMap((page) => idsOf(page))).toEqual(whole);
  });
});
