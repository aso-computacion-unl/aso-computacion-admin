import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { GetPublicContentUseCase } from "@/application/use-cases/get-public-content.use-case";
import { BoardMember } from "@/domain/board-member";
import { Event } from "@/domain/event";
import { EventPhoto } from "@/domain/event-photo";
import { Faq } from "@/domain/faq";
import { NewsItem } from "@/domain/news-item";
import { Pillar } from "@/domain/pillar";
import { SiteSettings } from "@/domain/site-settings";
import { SocialLink } from "@/domain/social-link";
import { BoardMemberPrismaRepository } from "@/infrastructure/repositories/board-member-prisma.repository";
import { EventPhotoPrismaRepository } from "@/infrastructure/repositories/event-photo-prisma.repository";
import { EventPrismaRepository } from "@/infrastructure/repositories/event-prisma.repository";
import { FaqPrismaRepository } from "@/infrastructure/repositories/faq-prisma.repository";
import { NewsPrismaRepository } from "@/infrastructure/repositories/news-prisma.repository";
import { PillarPrismaRepository } from "@/infrastructure/repositories/pillar-prisma.repository";
import { SiteSettingsPrismaRepository } from "@/infrastructure/repositories/site-settings-prisma.repository";
import { SocialLinkPrismaRepository } from "@/infrastructure/repositories/social-link-prisma.repository";
import { toPublicContentResponse } from "@/interface/public/public-content.mapper";

const events = new EventPrismaRepository();
const eventPhotos = new EventPhotoPrismaRepository();
const faqs = new FaqPrismaRepository();
const pillars = new PillarPrismaRepository();
const socials = new SocialLinkPrismaRepository();
const board = new BoardMemberPrismaRepository();
const settings = new SiteSettingsPrismaRepository();
const news = new NewsPrismaRepository();
const useCase = new GetPublicContentUseCase(events, eventPhotos, faqs, pillars, socials, board, settings, news);

const image = (name: string) => ({ url: `https://res.cloudinary.test/${name}.jpg`, publicId: `aso/${name}`, width: 1200, height: 800, alt: name });

// The real repositories behind the real use case and mapper: what the route serves, minus HTTP.
describe("public content (integration)", () => {
  it("is empty with null settings on a fresh database", async () => {
    const body = toPublicContentResponse(await useCase.execute(), new Date());

    expect(body).toMatchObject({ events: [], faqs: [], pillars: [], socials: [], board: [], settings: null, news: [] });
  });

  it("serves only published content in display order, with active photos and no internal fields", async () => {
    const next = await events.create(Event.create({ title: "Próximo", date: "2026-12-01", isPublished: true }));
    await events.create(Event.create({ title: "Borrador", date: "2027-01-01" }));
    await eventPhotos.add(EventPhoto.create({ eventId: next.props.id, ...image("a"), sortOrder: 0 }), 12);
    const hidden = await eventPhotos.add(EventPhoto.create({ eventId: next.props.id, ...image("hidden"), sortOrder: 0 }), 12);
    await eventPhotos.update(hidden.deactivate());
    await faqs.create(Faq.create({ question: "Segunda", answer: "b", sortOrder: 1, isPublished: true }));
    await faqs.create(Faq.create({ question: "Primera", answer: "a", sortOrder: 0, isPublished: true }));
    await faqs.create(Faq.create({ question: "Borrador", answer: "d", sortOrder: 2 }));
    await pillars.create(Pillar.create({ word: "VOZ", title: "Representamos", text: "t", sortOrder: 0, isPublished: true, image: image("pillar") }));
    await socials.create(SocialLink.create({ platform: "instagram", label: "Instagram", handle: "@aso", url: "https://instagram.com/aso", sortOrder: 0 }));
    await board.create(BoardMember.create({ name: "Oculta", role: "Tesorera", sortOrder: 0, photo: image("oculta") }));
    await board.create(BoardMember.create({ name: "Ana Pérez", role: "Presidenta", sortOrder: 1, photo: image("ana"), isPublished: true }));
    await settings.save(SiteSettings.create({ tagline: "Tagline", description: "Description", about: "About" }));
    const text = { summary: "Resumen", body: "Cuerpo **uno**" };
    await news.create(NewsItem.create({ ...text, title: "Vieja", publishedAt: "2026-01-10", isPublished: true }));
    await news.create(NewsItem.create({ ...text, title: "Borrador", publishedAt: "2026-09-01" }));
    await news.create(NewsItem.create({ ...text, title: "Reciente", publishedAt: "2026-05-01", isPublished: true, cover: image("news") }));

    const body = toPublicContentResponse(await useCase.execute(), new Date());

    expect(body.events.map((event) => [event.title, event.photos.map((photo) => photo.alt)])).toEqual([["Próximo", ["a"]]]);
    expect(body.faqs.map((faq) => faq.question)).toEqual(["Primera", "Segunda"]);
    expect(body.pillars).toEqual([{ word: "VOZ", title: "Representamos", text: "t", image: { url: image("pillar").url, width: 1200, height: 800, alt: "pillar" } }]);
    expect(body.socials).toEqual([]);
    expect(body.board).toEqual([{ name: "Ana Pérez", role: "Presidenta", photo: { url: image("ana").url, width: 1200, height: 800, alt: "ana" } }]);
    expect(body.settings).toEqual({ tagline: "Tagline", description: "Description", about: "About" });
    expect(body.news).toEqual([
      { slug: "reciente", title: "Reciente", summary: "Resumen", body: "Cuerpo **uno**", publishedAt: "2026-05-01", cover: { url: image("news").url, width: 1200, height: 800, alt: "news" } },
      { slug: "vieja", title: "Vieja", summary: "Resumen", body: "Cuerpo **uno**", publishedAt: "2026-01-10", cover: null },
    ]);
    expect(JSON.stringify(body)).not.toMatch(/publicId|aso\/|createdAt|updatedAt|isPublished/);
  });
});
