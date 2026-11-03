import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { BoardMember } from "@/domain/board-member";
import { Event } from "@/domain/event";
import { EventPhoto } from "@/domain/event-photo";
import { NewsItem } from "@/domain/news-item";
import { Pillar } from "@/domain/pillar";
import { Sponsor } from "@/domain/sponsor";
import { prisma } from "@/infrastructure/prisma/client";
import { BoardMemberPrismaRepository } from "@/infrastructure/repositories/board-member-prisma.repository";
import { EventPhotoPrismaRepository } from "@/infrastructure/repositories/event-photo-prisma.repository";
import { EventPrismaRepository } from "@/infrastructure/repositories/event-prisma.repository";
import { MediaUsagePrismaReader } from "@/infrastructure/repositories/media-usage-prisma.reader";
import { NewsPrismaRepository } from "@/infrastructure/repositories/news-prisma.repository";
import { PillarPrismaRepository } from "@/infrastructure/repositories/pillar-prisma.repository";
import { SponsorPrismaRepository } from "@/infrastructure/repositories/sponsor-prisma.repository";

const image = (name: string) => ({ url: `https://res.cloudinary.test/${name}.jpg`, publicId: `aso/${name}`, width: 1200, height: 800, alt: name });
const reader = new MediaUsagePrismaReader();
const markTrashed = (table: string, id: string) => prisma.$executeRawUnsafe(`UPDATE "${table}" SET "deletedAt" = now() WHERE "id" = $1`, id);

describe("media usage reader (integration)", () => {
  it("finds the event photo, pillar image, news cover and board photo that point at an image", async () => {
    const event = await new EventPrismaRepository().create(Event.create({ title: "Taller de Git" }));
    await new EventPhotoPrismaRepository().add(EventPhoto.create({ eventId: event.props.id, ...image("foto"), sortOrder: 0 }), 12);
    const pillar = await new PillarPrismaRepository().create(Pillar.create({ word: "VOZ", title: "Representamos", text: "t", sortOrder: 0, image: image("pilar") }));
    const news = await new NewsPrismaRepository().create(
      NewsItem.create({ title: "Novedad", summary: "Resumen", body: "Cuerpo", publishedAt: "2026-05-01", cover: image("portada") }),
    );
    const member = await new BoardMemberPrismaRepository().create(BoardMember.create({ name: "Ana Pérez", role: "Presidenta", sortOrder: 0, photo: image("ana") }));

    const usages = await reader.usagesOf(["aso/foto", "aso/pilar", "aso/portada", "aso/ana", "aso/nadie"]);

    expect(usages.get("aso/foto")).toEqual([{ kind: "event", id: event.props.id, label: "Taller de Git", hidden: false }]);
    expect(usages.get("aso/pilar")).toEqual([{ kind: "pillar", id: pillar.props.id, label: "Representamos", hidden: false }]);
    expect(usages.get("aso/portada")).toEqual([{ kind: "news", id: news.props.id, label: "Novedad", hidden: false }]);
    expect(usages.get("aso/ana")).toEqual([{ kind: "board", id: member.props.id, label: "Ana Pérez", hidden: false }]);
    expect(usages.has("aso/nadie")).toBe(false);
  });

  it("counts a photo taken off an event, and the image of a row in the trash, as a hidden use: the file is still theirs", async () => {
    const event = await new EventPrismaRepository().create(Event.create({ title: "Charla" }));
    const photo = await new EventPhotoPrismaRepository().add(EventPhoto.create({ eventId: event.props.id, ...image("quitada"), sortOrder: 0 }), 12);
    await prisma.eventPhoto.update({ where: { id: photo.props.id }, data: { isActive: false } });
    const pillar = await new PillarPrismaRepository().create(Pillar.create({ word: "RED", title: "Papelera", text: "t", sortOrder: 0, image: image("en-papelera") }));
    await markTrashed("Pillar", pillar.props.id);

    const usages = await reader.usagesOf(["aso/quitada", "aso/en-papelera"]);

    expect(usages.get("aso/quitada")?.map((use) => use.hidden)).toEqual([true]);
    expect(usages.get("aso/en-papelera")?.map((use) => use.hidden)).toEqual([true]);
  });

  it("marks a photo of a trashed event as hidden", async () => {
    const event = await new EventPrismaRepository().create(Event.create({ title: "Vieja" }));
    await new EventPhotoPrismaRepository().add(EventPhoto.create({ eventId: event.props.id, ...image("evento-papelera"), sortOrder: 0 }), 12);
    await markTrashed("Event", event.props.id);

    expect((await reader.usagesOf(["aso/evento-papelera"])).get("aso/evento-papelera")?.map((use) => use.hidden)).toEqual([true]);
  });

  it("finds the testimonial photo and the sponsor logo, and counts them as hidden uses while their rows are in the trash", async () => {
    // Testimonials are no longer managed by the app, but their kept rows still own their photo: insert one the way it was stored.
    const photo = image("testimonials/ana");
    const testimonial = await prisma.testimonial.create({
      data: { id: "testimonial-kept", quote: "Muy útil.", name: "Ana Pérez", role: "Egresada", sortOrder: 0, photoUrl: photo.url, photoPublicId: photo.publicId, photoWidth: photo.width, photoHeight: photo.height, photoAlt: photo.alt, updatedAt: new Date() },
    });
    const sponsor = await new SponsorPrismaRepository().create(Sponsor.create({ name: "Ñandú S.A.", sortOrder: 0, logo: image("sponsors/nandu") }));

    const live = await reader.usagesOf(["aso/testimonials/ana", "aso/sponsors/nandu"]);

    expect(live.get("aso/testimonials/ana")).toEqual([{ kind: "testimonial", id: testimonial.id, label: "Ana Pérez", hidden: false }]);
    expect(live.get("aso/sponsors/nandu")).toEqual([{ kind: "sponsor", id: sponsor.props.id, label: "Ñandú S.A.", hidden: false }]);

    await markTrashed("Testimonial", testimonial.id);
    await markTrashed("Sponsor", sponsor.props.id);

    const trashed = await reader.usagesOf(["aso/testimonials/ana", "aso/sponsors/nandu"]);

    expect(trashed.get("aso/testimonials/ana")?.map((use) => use.hidden)).toEqual([true]);
    expect(trashed.get("aso/sponsors/nandu")?.map((use) => use.hidden)).toEqual([true]);
  });

  it("answers an empty list without touching the database", async () => {
    expect((await reader.usagesOf([])).size).toBe(0);
  });
});
