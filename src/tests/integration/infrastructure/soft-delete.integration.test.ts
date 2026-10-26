import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { OrderedContent, OrderedContentRepository } from "@/application/ports/ordered-content-repository.port";
import { BoardMember } from "@/domain/board-member";
import { Event } from "@/domain/event";
import { EventPhoto } from "@/domain/event-photo";
import { Faq } from "@/domain/faq";
import { NewsItem } from "@/domain/news-item";
import { Pillar } from "@/domain/pillar";
import { SocialLink } from "@/domain/social-link";
import { TerminalCommand } from "@/domain/terminal-command";
import { prisma } from "@/infrastructure/prisma/client";
import { BoardMemberPrismaRepository } from "@/infrastructure/repositories/board-member-prisma.repository";
import { CommandNamePrismaRegistry } from "@/infrastructure/repositories/command-name-prisma.registry";
import { EventPhotoPrismaRepository } from "@/infrastructure/repositories/event-photo-prisma.repository";
import { EventPrismaRepository } from "@/infrastructure/repositories/event-prisma.repository";
import { FaqPrismaRepository } from "@/infrastructure/repositories/faq-prisma.repository";
import { NewsPrismaRepository } from "@/infrastructure/repositories/news-prisma.repository";
import { PillarPrismaRepository } from "@/infrastructure/repositories/pillar-prisma.repository";
import { SocialLinkPrismaRepository } from "@/infrastructure/repositories/social-link-prisma.repository";
import { TerminalCommandPrismaRepository } from "@/infrastructure/repositories/terminal-command-prisma.repository";

const image = (name: string) => ({ url: `https://res.cloudinary.test/${name}.jpg`, publicId: `aso/${name}`, width: 1200, height: 800, alt: name });
const markTrashed = (table: string, id: string) =>
  prisma.$executeRawUnsafe(`UPDATE "${table}" SET "deletedAt" = now() WHERE "id" = $1`, id);
const news = (title: string, slug?: string) =>
  NewsItem.create({ title, summary: "Resumen", body: "Cuerpo", publishedAt: "2026-05-01", ...(slug && { slug }) });

const events = new EventPrismaRepository();
const newsItems = new NewsPrismaRepository();
const faqs = new FaqPrismaRepository();
const commands = new TerminalCommandPrismaRepository();
const socials = new SocialLinkPrismaRepository();
const pillars = new PillarPrismaRepository();
const board = new BoardMemberPrismaRepository();

let nextCommand = 0;

/** The same read checks over a live and a trashed row of one admin-ordered content type. */
function itSkipsTrashed<E extends OrderedContent<E>>(table: string, repository: OrderedContentRepository<E>, make: () => E) {
  it(`${table}: getById, list, update and saveOrder treat a trashed row as absent and leave it untouched`, async () => {
    const kept = await repository.create(make());
    const trashed = await repository.create(make());
    await markTrashed(table, trashed.props.id);

    expect(await repository.getById(trashed.props.id)).toBeNull();
    expect((await repository.list()).map((item) => item.props.id)).toEqual([kept.props.id]);
    await expect(repository.update(trashed.withPublished(false))).rejects.toMatchObject({ name: "NotFoundError" });
    await expect(repository.saveOrder([kept.props.id, trashed.props.id])).rejects.toMatchObject({ name: "NotFoundError" });

    const rows = await prisma.$queryRawUnsafe<{ id: string; sortOrder: number; deletedAt: Date | null }[]>(`SELECT "id", "sortOrder", "deletedAt" FROM "${table}"`);
    expect(rows.find((row) => row.id === trashed.props.id)).toMatchObject({ sortOrder: 0 });
    expect(rows.find((row) => row.id === trashed.props.id)?.deletedAt).not.toBeNull();
    expect(rows.find((row) => row.id === kept.props.id)).toMatchObject({ sortOrder: 0 });
  });
}

describe("soft delete: schema (integration)", () => {
  it("adds a nullable deletedAt to the seven content tables and leaves new rows live", async () => {
    const columns = await prisma.$queryRaw<{ table_name: string; is_nullable: string }[]>`
      SELECT table_name, is_nullable FROM information_schema.columns
      WHERE table_schema = current_schema() AND column_name = 'deletedAt' ORDER BY table_name`;

    expect(columns).toEqual(
      ["BoardMember", "Event", "Faq", "NewsItem", "Pillar", "SocialLink", "TerminalCommand"].map((table_name) => ({ table_name, is_nullable: "YES" })),
    );

    const event = await events.create(Event.create({ title: "Charla" }));
    const [row] = await prisma.$queryRaw<{ deletedAt: Date | null }[]>`SELECT "deletedAt" FROM "Event" WHERE "id" = ${event.props.id}`;
    expect(row?.deletedAt).toBeNull();
  });

  it("keeps no plain unique index on the four collidable columns and no content table loses its asset uniqueness", async () => {
    const indexes = await prisma.$queryRaw<{ indexname: string; indexdef: string }[]>`
      SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = current_schema() AND indexdef LIKE 'CREATE UNIQUE%'`;
    const names = indexes.map((index) => index.indexname);

    expect(names).not.toEqual(expect.arrayContaining(["Event_slug_key"]));
    expect(names).not.toEqual(expect.arrayContaining(["NewsItem_slug_key"]));
    expect(names).not.toEqual(expect.arrayContaining(["Faq_command_key"]));
    expect(names).not.toEqual(expect.arrayContaining(["TerminalCommand_command_key"]));
    expect(names).toEqual(
      expect.arrayContaining(["Event_slug_live_key", "NewsItem_slug_live_key", "Faq_command_live_key", "TerminalCommand_command_live_key", "EventPhoto_publicId_key", "Pillar_imagePublicId_key", "NewsItem_coverPublicId_key", "BoardMember_photoPublicId_key"]),
    );
    expect(indexes.filter((index) => index.indexname.endsWith("_live_key")).every((index) => index.indexdef.includes('"deletedAt" IS NULL'))).toBe(true);
  });
});

describe("soft delete: partial unique indexes (integration)", () => {
  const cases = [
    { name: "event slug", table: "Event", create: (slug: string) => events.create(Event.create({ title: slug, slug })), field: "slug" },
    { name: "news slug", table: "NewsItem", create: (slug: string) => newsItems.create(news(slug, slug)), field: "slug" },
    { name: "FAQ command", table: "Faq", create: (command: string) => faqs.create(Faq.create({ question: "¿Q?", answer: "a", sortOrder: 0, command })), field: "command" },
    { name: "free command", table: "TerminalCommand", create: (command: string) => commands.create(TerminalCommand.create({ command, description: "d", output: "o", sortOrder: 0 })), field: "command" },
  ] as const;

  for (const { name, table, create, field } of cases) {
    it(`${name}: two trashed rows may share the value, a live duplicate is rejected`, async () => {
      const first = await create("repetido");
      await markTrashed(table, first.props.id);
      const second = await create("repetido");
      await markTrashed(table, second.props.id);
      const live = await create("repetido");

      await expect(create("repetido")).rejects.toMatchObject({ field });
      const stored = await prisma.$queryRawUnsafe<{ id: string; deletedAt: Date | null }[]>(`SELECT "id", "deletedAt" FROM "${table}" ORDER BY "createdAt"`);
      expect(stored.map((row) => [row.id, row.deletedAt === null])).toEqual([
        [first.props.id, false],
        [second.props.id, false],
        [live.props.id, true],
      ]);
    });

    it(`${name}: bringing a trashed row back to life over a live duplicate is refused and changes nothing`, async () => {
      const trashed = await create("choque");
      await markTrashed(table, trashed.props.id);
      await create("choque");

      await expect(prisma.$executeRawUnsafe(`UPDATE "${table}" SET "deletedAt" = NULL WHERE "id" = $1`, trashed.props.id)).rejects.toThrow(/23505/);

      const [row] = await prisma.$queryRawUnsafe<{ deletedAt: Date | null }[]>(`SELECT "deletedAt" FROM "${table}" WHERE "id" = $1`, trashed.props.id);
      expect(row?.deletedAt).not.toBeNull();
    });
  }

  it("FAQs without a command never collide, trashed or not", async () => {
    const a = await faqs.create(Faq.create({ question: "¿Uno?", answer: "a", sortOrder: 0 }));
    await markTrashed("Faq", a.props.id);
    await faqs.create(Faq.create({ question: "¿Dos?", answer: "b", sortOrder: 1 }));
    await faqs.create(Faq.create({ question: "¿Tres?", answer: "c", sortOrder: 2 }));

    expect(await faqs.list()).toHaveLength(2);
  });

  it("asset ids stay unique across trashed rows: a trashed pillar still owns its image", async () => {
    const pillar = await pillars.create(Pillar.create({ word: "VOZ", title: "Uno", text: "t", sortOrder: 0, image: image("compartida") }));
    await markTrashed("Pillar", pillar.props.id);

    await expect(pillars.create(Pillar.create({ word: "RED", title: "Dos", text: "t", sortOrder: 1, image: image("compartida") }))).rejects.toThrow();
  });
});

describe("soft delete: reads skip trashed rows (integration)", () => {
  itSkipsTrashed("Faq", faqs, () => Faq.create({ question: "¿Pregunta?", answer: "Respuesta", sortOrder: 0 }));
  itSkipsTrashed("TerminalCommand", commands, () => TerminalCommand.create({ command: `cmd-${nextCommand++}`, description: "Lista", output: "a b", sortOrder: 0 }));
  itSkipsTrashed("SocialLink", socials, () => SocialLink.create({ platform: "instagram", label: "Instagram", handle: "@aso", url: "https://instagram.com/aso", sortOrder: 0 }));
  itSkipsTrashed("Pillar", pillars, () => Pillar.create({ word: "VOZ", title: "Representamos", text: "t", sortOrder: 0 }));
  itSkipsTrashed("BoardMember", board, () => BoardMember.create({ name: "Ana Pérez", role: "Presidenta", sortOrder: 0, photo: image(crypto.randomUUID()) }));

  it("Event: getById, list, slugExists, counts and update skip a trashed event", async () => {
    const live = await events.create(Event.create({ title: "Vivo", isPublished: true }));
    const trashed = await events.create(Event.create({ title: "Papelera", isPublished: true }));
    await markTrashed("Event", trashed.props.id);

    expect(await events.getById(trashed.props.id)).toBeNull();
    expect((await events.list()).map((event) => event.props.id)).toEqual([live.props.id]);
    expect((await events.list({ status: "published" })).map((event) => event.props.id)).toEqual([live.props.id]);
    expect(await events.slugExists("papelera")).toBe(false);
    expect(await events.countByStatus()).toEqual({ published: 1, draft: 0 });
    await expect(events.update(trashed.update({ isPublished: false }))).rejects.toMatchObject({ name: "NotFoundError" });
  });

  it("News: getById, list, slugExists, counts and update skip a trashed item", async () => {
    const live = await newsItems.create(news("Viva").withPublished(true));
    const trashed = await newsItems.create(news("Papelera").withPublished(true));
    await markTrashed("NewsItem", trashed.props.id);

    expect(await newsItems.getById(trashed.props.id)).toBeNull();
    expect((await newsItems.list()).map((item) => item.props.id)).toEqual([live.props.id]);
    expect(await newsItems.slugExists("papelera")).toBe(false);
    expect(await newsItems.countByStatus()).toEqual({ published: 1, draft: 0 });
    await expect(newsItems.update(trashed.withPublished(false))).rejects.toMatchObject({ name: "NotFoundError" });
  });

  it("the command-name registry ignores a trashed FAQ and a trashed free command", async () => {
    const registry = new CommandNamePrismaRegistry();
    const faq = await faqs.create(Faq.create({ question: "¿Q?", answer: "a", sortOrder: 0, command: "costo" }));
    const free = await commands.create(TerminalCommand.create({ command: "lugar", description: "d", output: "o", sortOrder: 0 }));

    expect([await registry.findOwner("costo"), await registry.findOwner("lugar")]).toEqual(["faq", "command"]);

    await markTrashed("Faq", faq.props.id);
    await markTrashed("TerminalCommand", free.props.id);

    expect([await registry.findOwner("costo"), await registry.findOwner("lugar")]).toEqual([null, null]);
  });

  it("a photo cannot be attached to a trashed event, and nothing is stored", async () => {
    const photos = new EventPhotoPrismaRepository();
    const event = await events.create(Event.create({ title: "Papelera" }));
    await markTrashed("Event", event.props.id);

    await expect(photos.add(EventPhoto.create({ eventId: event.props.id, ...image("tarde"), sortOrder: 0 }), 12)).rejects.toMatchObject({ name: "NotFoundError" });

    expect(await prisma.eventPhoto.count()).toBe(0);
  });
});

describe("soft delete: trash, restore and purge through the repositories (integration)", () => {
  const photos = new EventPhotoPrismaRepository();
  const countRows = async (table: string, where = "TRUE") =>
    Number((await prisma.$queryRawUnsafe<{ n: bigint }[]>(`SELECT count(*) AS n FROM "${table}" WHERE ${where}`))[0]?.n);

  it("an event keeps its photos in the trash and gets them back on restore", async () => {
    const event = await events.create(Event.create({ title: "Taller", isPublished: true }));
    const photo = await photos.add(EventPhoto.create({ eventId: event.props.id, ...image("taller"), sortOrder: 0 }), 12);

    await events.trash(event.props.id);

    expect(await photos.listActiveByEventId(event.props.id)).toHaveLength(1);
    const trashed = await events.getTrashed(event.props.id);
    expect(trashed?.entity.props).toMatchObject({ isPublished: false, slug: "taller" });

    await events.restore(trashed!.entity);

    expect((await events.getById(event.props.id))?.props.isPublished).toBe(false);
    expect((await photos.listActiveByEventId(event.props.id)).map((item) => item.props.id)).toEqual([photo.props.id]);
  });

  it("purging a trashed event returns every photo id, active or not, and removes the rows", async () => {
    const event = await events.create(Event.create({ title: "Taller" }));
    await photos.add(EventPhoto.create({ eventId: event.props.id, ...image("a"), sortOrder: 0 }), 12);
    const hidden = await photos.add(EventPhoto.create({ eventId: event.props.id, ...image("b"), sortOrder: 1 }), 12);
    await photos.update(hidden.deactivate());
    await events.trash(event.props.id);

    expect((await events.purge(event.props.id)).sort()).toEqual(["aso/a", "aso/b"]);

    expect([await countRows("Event"), await countRows("EventPhoto")]).toEqual([0, 0]);
  });

  it("purging a live event is refused and removes nothing, photos included", async () => {
    const event = await events.create(Event.create({ title: "Vivo" }));
    await photos.add(EventPhoto.create({ eventId: event.props.id, ...image("vivo"), sortOrder: 0 }), 12);

    await expect(events.purge(event.props.id)).rejects.toMatchObject({ name: "NotFoundError" });
    await expect(events.purge(crypto.randomUUID())).rejects.toMatchObject({ name: "NotFoundError" });

    expect([await countRows("Event"), await countRows("EventPhoto")]).toEqual([1, 1]);
  });

  it("restoring an event whose slug a live one took is refused and nothing changes", async () => {
    const original = await events.create(Event.create({ title: "Charla", slug: "charla" }));
    await events.trash(original.props.id);
    const second = await events.create(Event.create({ title: "Charla bis", slug: "charla" }));
    await events.trash(second.props.id);
    const live = await events.create(Event.create({ title: "Charla viva", slug: "charla" }));

    expect((await events.listTrashed()).map((item) => item.entity.props.id)).toEqual([second.props.id, original.props.id]);
    await expect(events.restore(original)).rejects.toMatchObject({ name: "ValidationError", field: "slug" });

    expect((await events.listTrashed()).map((item) => item.entity.props.id)).toEqual([second.props.id, original.props.id]);
    expect((await events.list()).map((item) => item.props.id)).toEqual([live.props.id]);
  });

  it("news: trash, restore collision, restore and purge", async () => {
    const original = await newsItems.create(news("Aviso", "aviso").withPublished(true));
    await newsItems.trash(original.props.id);
    const live = await newsItems.create(news("Aviso vivo", "aviso"));

    await expect(newsItems.restore(original.withPublished(false))).rejects.toMatchObject({ name: "ValidationError", field: "slug" });
    expect((await newsItems.getTrashed(original.props.id))?.entity.props.isPublished).toBe(false);
    expect((await newsItems.list()).map((item) => item.props.id)).toEqual([live.props.id]);

    await newsItems.trash(live.props.id);
    const restored = await newsItems.restore(original.withPublished(false));

    expect(restored.props).toMatchObject({ id: original.props.id, isPublished: false });
    await expect(newsItems.purge(original.props.id)).rejects.toMatchObject({ name: "NotFoundError" });
    await newsItems.purge(live.props.id);
    expect(await countRows("NewsItem")).toBe(1);
  });

  it("FAQ: restoring a command a live FAQ took is refused and the trashed FAQ stays as it was", async () => {
    const original = await faqs.create(Faq.create({ question: "¿Costo?", answer: "a", sortOrder: 0, command: "costo" }));
    await faqs.trash(original.props.id);
    await faqs.create(Faq.create({ question: "¿Otro costo?", answer: "b", sortOrder: 0, command: "costo" }));

    await expect(faqs.restore(original)).rejects.toMatchObject({ name: "CommandNameConflictError", command: "costo" });

    expect(await countRows("Faq", `"deletedAt" IS NOT NULL`)).toBe(1);
    expect((await faqs.getTrashed(original.props.id))?.entity.props.command).toBe("costo");
  });

  it("free command: restoring a name a live command took is refused and nothing changes", async () => {
    const make = (description: string) => TerminalCommand.create({ command: "libre", description, output: "o", sortOrder: 0 });
    const original = await commands.create(make("Primero"));
    await commands.trash(original.props.id);
    const live = await commands.create(make("Segundo"));

    await expect(commands.restore(original)).rejects.toMatchObject({ name: "CommandNameConflictError", command: "libre" });

    expect((await commands.list()).map((item) => item.props.id)).toEqual([live.props.id]);
    expect((await commands.getTrashed(original.props.id))?.entity.props.description).toBe("Primero");
  });
});
