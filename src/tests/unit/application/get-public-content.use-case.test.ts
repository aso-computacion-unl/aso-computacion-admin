import { beforeEach, describe, expect, it } from "vitest";

import { GetPublicContentUseCase } from "@/application/use-cases/get-public-content.use-case";
import { BoardMember } from "@/domain/board-member";
import { Event } from "@/domain/event";
import { EventPhoto } from "@/domain/event-photo";
import { Faq } from "@/domain/faq";
import { NewsItem } from "@/domain/news-item";
import { Pillar } from "@/domain/pillar";
import { SiteSettings } from "@/domain/site-settings";
import { SocialLink } from "@/domain/social-link";
import { TerminalCommand } from "@/domain/terminal-command";
import { InMemoryEventPhotoRepository } from "@/tests/fakes/in-memory-event-photo.repository";
import { InMemoryEventRepository } from "@/tests/fakes/in-memory-event.repository";
import { InMemoryNewsRepository } from "@/tests/fakes/in-memory-news.repository";
import { InMemoryOrderedRepository } from "@/tests/fakes/in-memory-ordered-repository";
import { InMemorySiteSettingsRepository } from "@/tests/fakes/in-memory-site-settings.repository";

const image = (name: string) => ({ url: `https://res.cloudinary.test/${name}.jpg`, publicId: `aso/${name}`, width: 1200, height: 800, alt: name });

describe("GetPublicContentUseCase", () => {
  let events: InMemoryEventRepository;
  let eventPhotos: InMemoryEventPhotoRepository;
  let faqs: InMemoryOrderedRepository<Faq>;
  let pillars: InMemoryOrderedRepository<Pillar>;
  let socials: InMemoryOrderedRepository<SocialLink>;
  let board: InMemoryOrderedRepository<BoardMember>;
  let settings: InMemorySiteSettingsRepository;
  let news: InMemoryNewsRepository;
  let commands: InMemoryOrderedRepository<TerminalCommand>;
  let useCase: GetPublicContentUseCase;

  beforeEach(() => {
    eventPhotos = new InMemoryEventPhotoRepository();
    events = new InMemoryEventRepository(eventPhotos);
    faqs = new InMemoryOrderedRepository();
    pillars = new InMemoryOrderedRepository();
    socials = new InMemoryOrderedRepository();
    board = new InMemoryOrderedRepository();
    settings = new InMemorySiteSettingsRepository();
    news = new InMemoryNewsRepository();
    commands = new InMemoryOrderedRepository();
    useCase = new GetPublicContentUseCase(events, eventPhotos, faqs, pillars, socials, board, settings, news, commands);
  });

  it("is empty, with settings null, when nothing was ever saved", async () => {
    expect(await useCase.execute()).toEqual({ events: [], faqs: [], pillars: [], socials: [], board: [], settings: null, news: [], commands: [] });
  });

  it("returns only published events, newest date first, each with only its active photos in gallery order", async () => {
    const old = await events.create(Event.create({ title: "Viejo", date: "2025-01-10", isPublished: true }));
    const next = await events.create(Event.create({ title: "Próximo", date: "2026-12-01", isPublished: true }));
    await events.create(Event.create({ title: "Borrador", date: "2027-01-01" }));
    const add = (eventId: string, name: string, sortOrder: number) =>
      eventPhotos.add(EventPhoto.create({ eventId, ...image(name), sortOrder }), 12);
    const first = await add(next.props.id, "first", 0);
    const second = await add(next.props.id, "second", 0);
    const hidden = await add(next.props.id, "hidden", 0);
    await eventPhotos.update(hidden.deactivate());
    await eventPhotos.saveOrder(next.props.id, [second.props.id, first.props.id]);
    await add(old.props.id, "old", 0);

    const result = await useCase.execute();

    expect(result.events.map((event) => event.title)).toEqual(["Próximo", "Viejo"]);
    expect(result.events[0]?.photos.map((photo) => photo.alt)).toEqual(["second", "first"]);
    expect(result.events[1]?.photos.map((photo) => photo.alt)).toEqual(["old"]);
  });

  it("an event without photos gets an empty list, not a missing one", async () => {
    await events.create(Event.create({ title: "Sin fotos", isPublished: true }));

    expect((await useCase.execute()).events[0]?.photos).toEqual([]);
  });

  it("returns only published FAQs, pillars, socials and board members, in display order", async () => {
    await faqs.create(Faq.create({ question: "B", answer: "b", sortOrder: 1, isPublished: true }));
    await faqs.create(Faq.create({ question: "A", answer: "a", sortOrder: 0, isPublished: true }));
    await faqs.create(Faq.create({ question: "Draft", answer: "d", sortOrder: 2 }));
    await pillars.create(Pillar.create({ word: "VOZ", title: "Draft", text: "t", sortOrder: 0 }));
    await pillars.create(Pillar.create({ word: "APOYO", title: "Acompañamos", text: "t", sortOrder: 1, isPublished: true }));
    await socials.create(SocialLink.create({ platform: "instagram", label: "Instagram", handle: "@aso", url: "https://instagram.com/aso", sortOrder: 0 }));
    await socials.create(SocialLink.create({ platform: "tiktok", label: "TikTok", handle: "@aso", url: "https://tiktok.com/@aso", sortOrder: 1, isPublished: true }));
    await board.create(BoardMember.create({ name: "Hidden", role: "Tesorero", sortOrder: 0, photo: image("hidden") }));
    await board.create(BoardMember.create({ name: "Visible", role: "Presidente", sortOrder: 1, photo: image("visible"), isPublished: true }));

    const result = await useCase.execute();

    expect(result.faqs.map((faq) => faq.question)).toEqual(["A", "B"]);
    expect(result.pillars.map((pillar) => pillar.title)).toEqual(["Acompañamos"]);
    expect(result.socials.map((social) => social.label)).toEqual(["TikTok"]);
    expect(result.board.map((member) => member.name)).toEqual(["Visible"]);
  });

  it("returns only published free commands, in display order", async () => {
    const make = (command: string, sortOrder: number, isPublished = false) =>
      commands.create(TerminalCommand.create({ command, description: `d-${command}`, output: `o-${command}`, sortOrder, isPublished }));
    await make("segundo", 1, true);
    await make("borrador", 2);
    await make("primero", 0, true);

    const result = await useCase.execute();

    expect(result.commands.map((command) => [command.command, command.description, command.output])).toEqual([
      ["primero", "d-primero", "o-primero"],
      ["segundo", "d-segundo", "o-segundo"],
    ]);
  });

  it("returns the saved site settings, null until the first save", async () => {
    expect((await useCase.execute()).settings).toBeNull();

    await settings.save(SiteSettings.create({ tagline: "Tagline", description: "Description", about: "About" }));

    expect((await useCase.execute()).settings).toMatchObject({ tagline: "Tagline", description: "Description", about: "About" });
  });

  it("returns only published news, newest publication date first, with the cover when it has one", async () => {
    const text = { summary: "Resumen", body: "Cuerpo" };
    await news.create(NewsItem.create({ ...text, title: "Vieja", publishedAt: "2026-01-10", isPublished: true }));
    await news.create(NewsItem.create({ ...text, title: "Borrador", publishedAt: "2026-06-01" }));
    await news.create(NewsItem.create({ ...text, title: "Reciente", publishedAt: "2026-05-01", isPublished: true, cover: image("cover") }));

    const result = await useCase.execute();

    expect(result.news.map((item) => item.title)).toEqual(["Reciente", "Vieja"]);
    expect(result.news[0]?.cover).toEqual({ url: image("cover").url, width: 1200, height: 800, alt: "cover" });
    expect(result.news[1]?.cover).toBeNull();
  });
});

describe("GetPublicContentUseCase faq commands", () => {
  it("carries each published FAQ's command (null when it has none) in display order", async () => {
    const eventPhotos = new InMemoryEventPhotoRepository();
    const faqs = new InMemoryOrderedRepository<Faq>();
    const useCase = new GetPublicContentUseCase(
      new InMemoryEventRepository(eventPhotos),
      eventPhotos,
      faqs,
      new InMemoryOrderedRepository(),
      new InMemoryOrderedRepository(),
      new InMemoryOrderedRepository(),
      new InMemorySiteSettingsRepository(),
      new InMemoryNewsRepository(),
      new InMemoryOrderedRepository(),
    );
    await faqs.create(Faq.create({ question: "B", answer: "b", sortOrder: 1, isPublished: true }));
    await faqs.create(Faq.create({ question: "A", answer: "a", sortOrder: 0, isPublished: true, command: "costo" }));
    await faqs.create(Faq.create({ question: "Draft", answer: "d", sortOrder: 2, command: "borrador" }));

    expect((await useCase.execute()).faqs.map((faq) => [faq.question, faq.command])).toEqual([["A", "costo"], ["B", null]]);
  });
});

describe("GetPublicContentUseCase publication windows", () => {
  const OPEN = new Date("2026-11-02T13:00:00.000Z");
  const CLOSE = new Date("2026-11-09T13:00:00.000Z");
  const at = (base: Date, offsetMs: number) => new Date(base.getTime() + offsetMs);
  const text = { summary: "Resumen", body: "Cuerpo" };

  let events: InMemoryEventRepository;
  let news: InMemoryNewsRepository;
  let useCase: GetPublicContentUseCase;

  beforeEach(() => {
    const eventPhotos = new InMemoryEventPhotoRepository();
    events = new InMemoryEventRepository(eventPhotos);
    news = new InMemoryNewsRepository();
    useCase = new GetPublicContentUseCase(
      events,
      eventPhotos,
      new InMemoryOrderedRepository(),
      new InMemoryOrderedRepository(),
      new InMemoryOrderedRepository(),
      new InMemoryOrderedRepository(),
      new InMemorySiteSettingsRepository(),
      news,
      new InMemoryOrderedRepository(),
    );
  });

  const titlesAt = async (now: Date) => {
    const result = await useCase.execute({ now });

    return { events: result.events.map((event) => event.title), news: result.news.map((item) => item.title) };
  };

  it("hides a scheduled item before publishAt and shows it from that exact instant (inclusive start)", async () => {
    await events.create(Event.create({ title: "Programado", isPublished: true, publishAt: OPEN }));
    await news.create(NewsItem.create({ ...text, title: "Programada", isPublished: true, publishAt: OPEN }));

    expect(await titlesAt(at(OPEN, -1))).toEqual({ events: [], news: [] });
    expect(await titlesAt(OPEN)).toEqual({ events: ["Programado"], news: ["Programada"] });
  });

  it("shows an item up to the millisecond before unpublishAt and hides it from that exact instant (exclusive end)", async () => {
    await events.create(Event.create({ title: "Vence", isPublished: true, unpublishAt: CLOSE }));
    await news.create(NewsItem.create({ ...text, title: "Vence", isPublished: true, unpublishAt: CLOSE }));

    expect(await titlesAt(at(CLOSE, -1))).toEqual({ events: ["Vence"], news: ["Vence"] });
    expect(await titlesAt(CLOSE)).toEqual({ events: [], news: [] });
  });

  it("keeps a draft hidden even in the middle of its window", async () => {
    await events.create(Event.create({ title: "Borrador", publishAt: OPEN, unpublishAt: CLOSE }));
    await news.create(NewsItem.create({ ...text, title: "Borrador", publishAt: OPEN, unpublishAt: CLOSE }));

    expect(await titlesAt(at(OPEN, 1000))).toEqual({ events: [], news: [] });
  });

  it("serves items without a window exactly as before, at any time", async () => {
    await events.create(Event.create({ title: "Siempre", isPublished: true }));
    await news.create(NewsItem.create({ ...text, title: "Siempre", isPublished: true }));
    await events.create(Event.create({ title: "Borrador" }));

    for (const now of [new Date(0), OPEN, new Date("2999-01-01T00:00:00Z")]) {
      expect(await titlesAt(now)).toEqual({ events: ["Siempre"], news: ["Siempre"] });
    }
    // No argument at all is the current time, the way the route used to call it.
    expect((await useCase.execute()).events.map((event) => event.title)).toEqual(["Siempre"]);
  });

  it("only gives scheduled items their photos once they are live", async () => {
    const { props } = await events.create(Event.create({ title: "Programado", isPublished: true, publishAt: OPEN }));

    expect((await useCase.execute({ now: at(OPEN, -1) })).events).toEqual([]);
    expect((await useCase.execute({ now: OPEN })).events[0]).toMatchObject({ slug: props.slug, photos: [] });
  });
});

describe("GetPublicContentUseCase preview", () => {
  const OPEN = new Date("2026-11-02T13:00:00.000Z");
  const CLOSE = new Date("2026-11-09T13:00:00.000Z");
  const text = { summary: "Resumen", body: "Cuerpo" };

  it("adds drafts and scheduled items, everywhere, but still hides what already expired", async () => {
    const eventPhotos = new InMemoryEventPhotoRepository();
    const events = new InMemoryEventRepository(eventPhotos);
    const news = new InMemoryNewsRepository();
    const faqs = new InMemoryOrderedRepository<Faq>();
    const useCase = new GetPublicContentUseCase(
      events,
      eventPhotos,
      faqs,
      new InMemoryOrderedRepository(),
      new InMemoryOrderedRepository(),
      new InMemoryOrderedRepository(),
      new InMemorySiteSettingsRepository(),
      news,
      new InMemoryOrderedRepository(),
    );
    const now = new Date("2026-11-05T00:00:00.000Z");
    await events.create(Event.create({ title: "En vivo", isPublished: true }));
    await events.create(Event.create({ title: "Borrador" }));
    await events.create(Event.create({ title: "Programado", isPublished: true, publishAt: CLOSE }));
    await events.create(Event.create({ title: "Vencido", isPublished: true, unpublishAt: OPEN }));
    await news.create(NewsItem.create({ ...text, title: "Programada", isPublished: true, publishAt: CLOSE }));
    await news.create(NewsItem.create({ ...text, title: "Vencida", isPublished: true, unpublishAt: OPEN }));
    await faqs.create(Faq.create({ question: "Borrador", answer: "a", sortOrder: 0 }));

    const publicView = await useCase.execute({ now });
    const preview = await useCase.execute({ now, includeUnpublished: true });

    expect(publicView.events.map((event) => event.title)).toEqual(["En vivo"]);
    expect(publicView.faqs).toEqual([]);
    expect(preview.events.map((event) => event.title).sort()).toEqual(["Borrador", "En vivo", "Programado"]);
    expect(preview.news.map((item) => item.title)).toEqual(["Programada"]);
    expect(preview.faqs.map((faq) => faq.question)).toEqual(["Borrador"]);
  });
});
