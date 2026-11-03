import { beforeEach, describe, expect, it, vi } from "vitest";

import { ListTrashUseCase } from "@/application/use-cases/list-trash.use-case";
import { PurgeBoardMemberUseCase, PurgeContentUseCase, PurgeEventUseCase, PurgeNewsItemUseCase, PurgePillarUseCase } from "@/application/use-cases/purge-content.use-case";
import { NotFoundError } from "@/application/use-cases/use-case-error";
import { BoardMember } from "@/domain/board-member";
import { Event } from "@/domain/event";
import { EventPhoto } from "@/domain/event-photo";
import { Faq } from "@/domain/faq";
import { NewsItem } from "@/domain/news-item";
import { Pillar } from "@/domain/pillar";
import { SocialLink } from "@/domain/social-link";
import { TerminalCommand } from "@/domain/terminal-command";
import { InMemoryEventPhotoRepository } from "@/tests/fakes/in-memory-event-photo.repository";
import { InMemoryEventRepository } from "@/tests/fakes/in-memory-event.repository";
import { InMemoryMediaStorage } from "@/tests/fakes/in-memory-media-storage";
import { InMemoryNewsRepository } from "@/tests/fakes/in-memory-news.repository";
import { InMemoryOrderedRepository } from "@/tests/fakes/in-memory-ordered-repository";

const MISSING_ID = "00000000-0000-0000-0000-000000000000";
const image = (name: string) => ({ url: `https://img.test/${name}.jpg`, publicId: `aso/${name}`, width: 1200, height: 800, alt: name });
const news = (title: string, extra: { slug?: string; cover?: ReturnType<typeof image>; isPublished?: boolean } = {}) =>
  NewsItem.create({ title, summary: "Resumen", body: "Cuerpo", publishedAt: "2026-05-01", ...extra });

describe("purge and list-trash use cases", () => {
  let photos: InMemoryEventPhotoRepository;
  let events: InMemoryEventRepository;
  let newsItems: InMemoryNewsRepository;
  let faqs: InMemoryOrderedRepository<Faq>;
  let commands: InMemoryOrderedRepository<TerminalCommand>;
  let socials: InMemoryOrderedRepository<SocialLink>;
  let pillars: InMemoryOrderedRepository<Pillar>;
  let board: InMemoryOrderedRepository<BoardMember>;
  let storage: InMemoryMediaStorage;

  beforeEach(() => {
    photos = new InMemoryEventPhotoRepository();
    events = new InMemoryEventRepository(photos);
    newsItems = new InMemoryNewsRepository();
    faqs = new InMemoryOrderedRepository();
    commands = new InMemoryOrderedRepository();
    socials = new InMemoryOrderedRepository();
    pillars = new InMemoryOrderedRepository();
    board = new InMemoryOrderedRepository();
    storage = new InMemoryMediaStorage();
  });

  describe("PurgeContentUseCase", () => {
    it("removes a trashed item for good; a live one is refused and kept", async () => {
      const live = await faqs.create(Faq.create({ question: "¿Vivo?", answer: "a", sortOrder: 0 }));
      const gone = await faqs.create(Faq.create({ question: "¿Papelera?", answer: "b", sortOrder: 1 }));
      await faqs.trash(gone.props.id);
      const purge = new PurgeContentUseCase(faqs, "Faq not found");

      await expect(purge.execute({ id: live.props.id })).rejects.toBeInstanceOf(NotFoundError);
      await purge.execute({ id: gone.props.id });

      expect((await faqs.list()).map((faq) => faq.props.id)).toEqual([live.props.id]);
      expect(await faqs.listTrashed()).toEqual([]);
      await expect(purge.execute({ id: gone.props.id })).rejects.toBeInstanceOf(NotFoundError);
    });

    it("destroys the stored image of a pillar, a board member and a news cover, only after the purge", async () => {
      const pillar = await pillars.create(Pillar.create({ word: "VOZ", title: "Uno", text: "t", sortOrder: 0, image: image("pillar") }));
      const member = await board.create(BoardMember.create({ name: "Ana Pérez", role: "Presidenta", sortOrder: 0, photo: image("ana") }));
      const item = await newsItems.create(news("Aviso", { cover: image("cover") }));
      for (const [repository, id] of [[pillars, pillar.props.id], [board, member.props.id], [newsItems, item.props.id]] as const) {
        await repository.trash(id);
      }

      await new PurgePillarUseCase(pillars, storage).execute({ id: pillar.props.id });
      await new PurgeBoardMemberUseCase(board, storage).execute({ id: member.props.id });
      await new PurgeNewsItemUseCase(newsItems, storage).execute({ id: item.props.id });

      expect(storage.destroyedPublicIds).toEqual(["aso/pillar", "aso/ana", "aso/cover"]);
    });

    it("destroys nothing for a live item, an unknown one, or an item without an image", async () => {
      const live = await pillars.create(Pillar.create({ word: "VOZ", title: "Vivo", text: "t", sortOrder: 0, image: image("vivo") }));
      const plain = await pillars.create(Pillar.create({ word: "RED", title: "Sin imagen", text: "t", sortOrder: 1 }));
      await pillars.trash(plain.props.id);
      const purge = new PurgePillarUseCase(pillars, storage);

      await expect(purge.execute({ id: live.props.id })).rejects.toBeInstanceOf(NotFoundError);
      await expect(purge.execute({ id: MISSING_ID })).rejects.toBeInstanceOf(NotFoundError);
      await purge.execute({ id: plain.props.id });

      expect(storage.destroyedPublicIds).toEqual([]);
    });

    it("keeps the image when the purge itself fails, and still succeeds when the destroy fails (logging the leftover)", async () => {
      const first = await pillars.create(Pillar.create({ word: "VOZ", title: "Uno", text: "t", sortOrder: 0, image: image("uno") }));
      const second = await pillars.create(Pillar.create({ word: "RED", title: "Dos", text: "t", sortOrder: 1, image: image("dos") }));
      await pillars.trash(first.props.id);
      await pillars.trash(second.props.id);
      const purge = new PurgePillarUseCase(pillars, storage);
      const log = vi.spyOn(console, "error").mockImplementation(() => {});
      vi.spyOn(pillars, "purge").mockRejectedValueOnce(new Error("db down"));

      await expect(purge.execute({ id: first.props.id })).rejects.toThrow("db down");
      expect(storage.destroyedPublicIds).toEqual([]);

      storage.destroyError = new Error("cloudinary down");
      await expect(purge.execute({ id: second.props.id })).resolves.toBeUndefined();

      expect(String(log.mock.calls[0]?.[0])).toContain("aso/dos");
      log.mockRestore();
    });
  });

  describe("PurgeEventUseCase", () => {
    async function trashedEventWithPhotos(...publicIds: string[]) {
      const event = await events.create(Event.create({ title: "Charla" }));

      for (const publicId of publicIds) {
        await photos.add(EventPhoto.create({ eventId: event.props.id, ...image(publicId), publicId, sortOrder: 0 }), 12);
      }

      await events.trash(event.props.id);
      return event;
    }

    it("removes the trashed event and destroys every stored photo, active or not", async () => {
      const event = await trashedEventWithPhotos("events/a", "events/b");
      const hidden = (await photos.listActiveByEventId(event.props.id))[1]!;
      await photos.update(hidden.deactivate());

      await new PurgeEventUseCase(events, storage).execute({ id: event.props.id });

      expect([...storage.destroyedPublicIds].sort()).toEqual(["events/a", "events/b"]);
      expect(await events.listTrashed()).toEqual([]);
    });

    it("refuses a live event: nothing is removed or destroyed", async () => {
      const event = await events.create(Event.create({ title: "Vivo" }));
      await photos.add(EventPhoto.create({ eventId: event.props.id, ...image("vivo"), sortOrder: 0 }), 12);

      await expect(new PurgeEventUseCase(events, storage).execute({ id: event.props.id })).rejects.toBeInstanceOf(NotFoundError);
      await expect(new PurgeEventUseCase(events, storage).execute({ id: MISSING_ID })).rejects.toBeInstanceOf(NotFoundError);

      expect(await events.getById(event.props.id)).not.toBeNull();
      expect(await photos.listActiveByEventId(event.props.id)).toHaveLength(1);
      expect(storage.destroyedPublicIds).toEqual([]);
    });

    it("destroys nothing when the purge fails, and still succeeds when storage cleanup fails, logging the publicIds left behind", async () => {
      const failing = await trashedEventWithPhotos("events/a");
      vi.spyOn(events, "purge").mockRejectedValueOnce(new Error("db down"));

      await expect(new PurgeEventUseCase(events, storage).execute({ id: failing.props.id })).rejects.toThrow("db down");
      expect(storage.destroyedPublicIds).toEqual([]);

      storage.destroyError = new Error("cloudinary down");
      const log = vi.spyOn(console, "error").mockImplementation(() => {});

      await expect(new PurgeEventUseCase(events, storage).execute({ id: failing.props.id })).resolves.toBeUndefined();

      expect(String(log.mock.calls[0]?.[0])).toContain("events/a");
      log.mockRestore();
    });
  });

  describe("ListTrashUseCase", () => {
    it("lists every type, newest deletion first, with a title per type", async () => {
      const event = await events.create(Event.create({ title: "Taller de Git" }));
      const item = await newsItems.create(news("Aviso"));
      const faq = await faqs.create(Faq.create({ question: "¿Costo?", answer: "a", sortOrder: 0 }));
      const command = await commands.create(TerminalCommand.create({ command: "libre", description: "d", output: "o", sortOrder: 0 }));
      const link = await socials.create(SocialLink.create({ platform: "instagram", label: "Instagram", handle: "@aso", url: "https://instagram.com/aso", sortOrder: 0 }));
      const pillar = await pillars.create(Pillar.create({ word: "VOZ", title: "Representamos", text: "t", sortOrder: 0 }));
      const member = await board.create(BoardMember.create({ name: "Ana Pérez", role: "Presidenta", sortOrder: 0, photo: image("ana") }));
      await events.trash(event.props.id);
      await newsItems.trash(item.props.id);
      await faqs.trash(faq.props.id);
      await commands.trash(command.props.id);
      await socials.trash(link.props.id);
      await pillars.trash(pillar.props.id);
      await board.trash(member.props.id);

      const trash = await new ListTrashUseCase({ events, news: newsItems, faqs, commands, socials, pillars, board }).execute();

      expect(trash.map(({ kind, title }) => [kind, title])).toEqual([
        ["board", "Ana Pérez"],
        ["pillar", "Representamos"],
        ["social", "Instagram"],
        ["command", "libre"],
        ["faq", "¿Costo?"],
        ["news", "Aviso"],
        ["event", "Taller de Git"],
      ]);
      expect(trash.map((entry) => entry.id)).toEqual([member, pillar, link, command, faq, item, event].map((entity) => entity.props.id));
      expect(trash.every((entry, index) => index === 0 || entry.deletedAt <= trash[index - 1]!.deletedAt)).toBe(true);
    });

    it("is empty when nothing was deleted, and leaves live items out", async () => {
      await faqs.create(Faq.create({ question: "¿Vivo?", answer: "a", sortOrder: 0 }));

      expect(await new ListTrashUseCase({ events, news: newsItems, faqs, commands, socials, pillars, board }).execute()).toEqual([]);
    });
  });
});
