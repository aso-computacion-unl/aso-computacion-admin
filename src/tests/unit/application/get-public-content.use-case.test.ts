import { beforeEach, describe, expect, it } from "vitest";

import { GetPublicContentUseCase } from "@/application/use-cases/get-public-content.use-case";
import { BoardMember } from "@/domain/board-member";
import { Event } from "@/domain/event";
import { EventPhoto } from "@/domain/event-photo";
import { Faq } from "@/domain/faq";
import { Pillar } from "@/domain/pillar";
import { SiteSettings } from "@/domain/site-settings";
import { SocialLink } from "@/domain/social-link";
import { InMemoryEventPhotoRepository } from "@/tests/fakes/in-memory-event-photo.repository";
import { InMemoryEventRepository } from "@/tests/fakes/in-memory-event.repository";
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
  let useCase: GetPublicContentUseCase;

  beforeEach(() => {
    eventPhotos = new InMemoryEventPhotoRepository();
    events = new InMemoryEventRepository(eventPhotos);
    faqs = new InMemoryOrderedRepository();
    pillars = new InMemoryOrderedRepository();
    socials = new InMemoryOrderedRepository();
    board = new InMemoryOrderedRepository();
    settings = new InMemorySiteSettingsRepository();
    useCase = new GetPublicContentUseCase(events, eventPhotos, faqs, pillars, socials, board, settings);
  });

  it("is empty, with settings null, when nothing was ever saved", async () => {
    expect(await useCase.execute()).toEqual({ events: [], faqs: [], pillars: [], socials: [], board: [], settings: null });
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

  it("returns the saved site settings, null until the first save", async () => {
    expect((await useCase.execute()).settings).toBeNull();

    await settings.save(SiteSettings.create({ tagline: "Tagline", description: "Description", about: "About" }));

    expect((await useCase.execute()).settings).toMatchObject({ tagline: "Tagline", description: "Description", about: "About" });
  });
});
