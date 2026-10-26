import { beforeEach, describe, expect, it } from "vitest";

import {
  RestoreContentUseCase,
  RestoreEventUseCase,
  RestoreFaqUseCase,
  RestoreNewsItemUseCase,
  RestoreOrderedContentUseCase,
  RestoreTerminalCommandUseCase,
} from "@/application/use-cases/restore-content.use-case";
import { TrashContentUseCase } from "@/application/use-cases/trash-content.use-case";
import { NotFoundError, RestoreConflictError } from "@/application/use-cases/use-case-error";
import { BoardMember } from "@/domain/board-member";
import { Event } from "@/domain/event";
import { EventPhoto } from "@/domain/event-photo";
import { Faq } from "@/domain/faq";
import { NewsItem } from "@/domain/news-item";
import { Pillar } from "@/domain/pillar";
import { SocialLink } from "@/domain/social-link";
import { TerminalCommand } from "@/domain/terminal-command";
import { InMemoryCommandNameRegistry } from "@/tests/fakes/in-memory-command-name-registry";
import { InMemoryEventPhotoRepository } from "@/tests/fakes/in-memory-event-photo.repository";
import { InMemoryEventRepository } from "@/tests/fakes/in-memory-event.repository";
import { InMemoryNewsRepository } from "@/tests/fakes/in-memory-news.repository";
import { InMemoryOrderedRepository } from "@/tests/fakes/in-memory-ordered-repository";

const MISSING_ID = "00000000-0000-0000-0000-000000000000";
const image = (name: string) => ({ url: `https://img.test/${name}.jpg`, publicId: `aso/${name}`, width: 1200, height: 800, alt: name });
const news = (title: string, extra: { slug?: string; cover?: ReturnType<typeof image>; isPublished?: boolean } = {}) =>
  NewsItem.create({ title, summary: "Resumen", body: "Cuerpo", publishedAt: "2026-05-01", ...extra });

describe("trash and restore use cases", () => {
  let photos: InMemoryEventPhotoRepository;
  let events: InMemoryEventRepository;
  let newsItems: InMemoryNewsRepository;
  let faqs: InMemoryOrderedRepository<Faq>;
  let commands: InMemoryOrderedRepository<TerminalCommand>;
  let socials: InMemoryOrderedRepository<SocialLink>;
  let pillars: InMemoryOrderedRepository<Pillar>;
  let board: InMemoryOrderedRepository<BoardMember>;

  beforeEach(() => {
    photos = new InMemoryEventPhotoRepository();
    events = new InMemoryEventRepository(photos);
    newsItems = new InMemoryNewsRepository();
    faqs = new InMemoryOrderedRepository();
    commands = new InMemoryOrderedRepository();
    socials = new InMemoryOrderedRepository();
    pillars = new InMemoryOrderedRepository();
    board = new InMemoryOrderedRepository();
  });

  describe("TrashContentUseCase", () => {
    it("moves a published item to the trash, unpublished, and says it was published", async () => {
      const faq = await faqs.create(Faq.create({ question: "¿Costo?", answer: "a", sortOrder: 0, isPublished: true }));

      const outcome = await new TrashContentUseCase(faqs, "Faq not found").execute({ id: faq.props.id });

      expect(outcome).toEqual({ wasPublished: true });
      expect(await faqs.list()).toEqual([]);
      expect((await faqs.getTrashed(faq.props.id))?.entity.props.isPublished).toBe(false);
    });

    it("says a draft was not published, so nothing public changed", async () => {
      const event = await events.create(Event.create({ title: "Borrador" }));

      expect(await new TrashContentUseCase(events, "Event not found").execute({ id: event.props.id })).toEqual({ wasPublished: false });
    });

    it("throws NotFoundError for an unknown or already trashed item and keeps the trash as it was", async () => {
      const item = await newsItems.create(news("Aviso"));
      const trash = new TrashContentUseCase(newsItems, "News item not found");
      await trash.execute({ id: item.props.id });

      await expect(trash.execute({ id: item.props.id })).rejects.toBeInstanceOf(NotFoundError);
      await expect(trash.execute({ id: MISSING_ID })).rejects.toBeInstanceOf(NotFoundError);

      expect(await newsItems.listTrashed()).toHaveLength(1);
    });

    it("keeps an event's photos attached", async () => {
      const event = await events.create(Event.create({ title: "Taller" }));
      await photos.add(EventPhoto.create({ eventId: event.props.id, ...image("taller"), sortOrder: 0 }), 12);

      await new TrashContentUseCase(events, "Event not found").execute({ id: event.props.id });

      expect(await photos.listActiveByEventId(event.props.id)).toHaveLength(1);
    });
  });

  describe("RestoreContentUseCase", () => {
    it("brings an ordered item back as a draft at the end of the list, never colliding with a position", async () => {
      const [a, b] = [await pillars.create(Pillar.create({ word: "VOZ", title: "Uno", text: "t", sortOrder: 0, isPublished: true })), await pillars.create(Pillar.create({ word: "RED", title: "Dos", text: "t", sortOrder: 1 }))];
      await pillars.trash(a.props.id);
      const c = await pillars.create(Pillar.create({ word: "GIT", title: "Tres", text: "t", sortOrder: 2 }));

      await new RestoreOrderedContentUseCase(pillars, "Pillar not found").execute({ id: a.props.id });

      const list = await pillars.list();
      expect(list.map((pillar) => pillar.props.id)).toEqual([b.props.id, c.props.id, a.props.id]);
      expect(list.map((pillar) => pillar.props.sortOrder)).toEqual([1, 2, 3]);
      expect(list.at(-1)?.props.isPublished).toBe(false);
      expect(await pillars.listTrashed()).toEqual([]);
    });

    it("restores into an empty list at position 0", async () => {
      const link = await socials.create(SocialLink.create({ platform: "instagram", label: "Instagram", handle: "@aso", url: "https://instagram.com/aso", sortOrder: 4 }));
      await socials.trash(link.props.id);

      await new RestoreOrderedContentUseCase(socials, "Social link not found").execute({ id: link.props.id });

      expect((await socials.list()).map((item) => item.props.sortOrder)).toEqual([0]);
    });

    it("restores an event and a news item as drafts, and an event gets its photos back", async () => {
      const event = await events.create(Event.create({ title: "Taller", isPublished: true }));
      await photos.add(EventPhoto.create({ eventId: event.props.id, ...image("taller"), sortOrder: 0 }), 12);
      const item = await newsItems.create(news("Aviso", { isPublished: true }));
      await events.trash(event.props.id);
      await newsItems.trash(item.props.id);

      await new RestoreEventUseCase(events).execute({ id: event.props.id });
      await new RestoreNewsItemUseCase(newsItems).execute({ id: item.props.id });

      expect((await events.getById(event.props.id))?.props.isPublished).toBe(false);
      expect((await newsItems.getById(item.props.id))?.props.isPublished).toBe(false);
      expect(await photos.listActiveByEventId(event.props.id)).toHaveLength(1);
    });

    it("refuses to restore an event whose slug a live event took, and changes nothing", async () => {
      const original = await events.create(Event.create({ title: "Charla", slug: "charla" }));
      await events.trash(original.props.id);
      const live = await events.create(Event.create({ title: "Charla nueva", slug: "charla" }));

      await expect(new RestoreEventUseCase(events).execute({ id: original.props.id })).rejects.toEqual(new RestoreConflictError("slug", "charla", "event"));

      expect((await events.list()).map((event) => event.props.id)).toEqual([live.props.id]);
      expect((await events.listTrashed()).map((item) => item.entity.props.id)).toEqual([original.props.id]);
    });

    it("refuses to restore a news item whose slug a live one took, and changes nothing", async () => {
      const original = await newsItems.create(news("Aviso", { slug: "aviso" }));
      await newsItems.trash(original.props.id);
      await newsItems.create(news("Aviso nuevo", { slug: "aviso" }));

      await expect(new RestoreNewsItemUseCase(newsItems).execute({ id: original.props.id })).rejects.toEqual(new RestoreConflictError("slug", "aviso", "news"));

      expect(await newsItems.listTrashed()).toHaveLength(1);
      expect(await newsItems.list()).toHaveLength(1);
    });

    it("refuses to restore a FAQ whose command a live FAQ or a live free command took", async () => {
      const registry = new InMemoryCommandNameRegistry(faqs, commands);
      const restore = new RestoreFaqUseCase(faqs, registry);
      const byFaq = await faqs.create(Faq.create({ question: "¿Uno?", answer: "a", sortOrder: 0, command: "costo" }));
      const byCommand = await faqs.create(Faq.create({ question: "¿Dos?", answer: "b", sortOrder: 1, command: "lugar" }));
      await faqs.trash(byFaq.props.id);
      await faqs.trash(byCommand.props.id);
      await faqs.create(Faq.create({ question: "¿Otro?", answer: "c", sortOrder: 0, command: "costo" }));
      await commands.create(TerminalCommand.create({ command: "lugar", description: "d", output: "o", sortOrder: 0 }));

      await expect(restore.execute({ id: byFaq.props.id })).rejects.toEqual(new RestoreConflictError("command", "costo", "faq"));
      await expect(restore.execute({ id: byCommand.props.id })).rejects.toEqual(new RestoreConflictError("command", "lugar", "command"));

      expect((await faqs.listTrashed()).map((item) => item.entity.props.id).sort()).toEqual([byFaq.props.id, byCommand.props.id].sort());
      expect(await faqs.list()).toHaveLength(1);
    });

    it("restores a FAQ without a command, and one whose command is free, even if a trashed row had it", async () => {
      const registry = new InMemoryCommandNameRegistry(faqs, commands);
      const plain = await faqs.create(Faq.create({ question: "¿Uno?", answer: "a", sortOrder: 0 }));
      const named = await faqs.create(Faq.create({ question: "¿Dos?", answer: "b", sortOrder: 1, command: "costo" }));
      await faqs.trash(plain.props.id);
      await faqs.trash(named.props.id);

      await new RestoreFaqUseCase(faqs, registry).execute({ id: plain.props.id });
      await new RestoreFaqUseCase(faqs, registry).execute({ id: named.props.id });

      expect((await faqs.list()).map((faq) => faq.props.command)).toEqual([null, "costo"]);
    });

    it("refuses to restore a free command whose name a live FAQ or command took", async () => {
      const registry = new InMemoryCommandNameRegistry(faqs, commands);
      const original = await commands.create(TerminalCommand.create({ command: "libre", description: "d", output: "o", sortOrder: 0 }));
      await commands.trash(original.props.id);
      await faqs.create(Faq.create({ question: "¿Libre?", answer: "a", sortOrder: 0, command: "libre" }));

      await expect(new RestoreTerminalCommandUseCase(commands, registry).execute({ id: original.props.id })).rejects.toEqual(
        new RestoreConflictError("command", "libre", "faq"),
      );
      expect(await commands.listTrashed()).toHaveLength(1);
      expect(await commands.list()).toEqual([]);
    });

    it("throws NotFoundError for a live or unknown item and changes nothing", async () => {
      const live = await board.create(BoardMember.create({ name: "Ana Pérez", role: "Presidenta", sortOrder: 3, photo: image("ana") }));
      const restore = new RestoreContentUseCase(board, "Board member not found", async (member) => member);

      await expect(restore.execute({ id: live.props.id })).rejects.toBeInstanceOf(NotFoundError);
      await expect(restore.execute({ id: MISSING_ID })).rejects.toBeInstanceOf(NotFoundError);

      expect((await board.list()).map((member) => member.props.sortOrder)).toEqual([3]);
    });
  });
});
