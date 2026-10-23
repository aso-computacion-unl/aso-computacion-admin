import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { parseLandingSeedContent } from "@/application/seed/landing-seed-content";
import { SeedLandingContentUseCase } from "@/application/seed/seed-landing-content.use-case";
import { prisma } from "@/infrastructure/prisma/client";
import {
  BoardMemberPrismaRepository,
  EventPrismaRepository,
  FaqPrismaRepository,
  PillarPrismaRepository,
  SiteSettingsPrismaRepository,
  SocialLinkPrismaRepository,
} from "@/infrastructure";
import { InMemoryMediaStorage } from "@/tests/fakes/in-memory-media-storage";

const CONTENT = parseLandingSeedContent({
  version: 1,
  events: [
    { slug: "bienvenida", title: "Bienvenida", date: "2026-04-14", type: "comunidad" },
    { slug: "semana", title: "Semana del Estudiante", date: "2026-02-01", datePrecision: "month", highlights: ["FLISOL"] },
  ],
  faqs: [{ question: "¿Quién puede participar?", answer: "Cualquier estudiante." }],
  pillars: [{ word: "Comunidad", title: "Nadie empieza solo", text: "Texto", image: { url: "/src/assets/p.jpg", width: 1600, height: 900, alt: "Estudiantes" } }],
  socials: [{ platform: "instagram", label: "Instagram", handle: "@aso", url: "https://www.instagram.com/aso/" }],
  board: [
    { name: "Ana Pérez", role: "Presidenta", photo: { url: "/src/assets/team/ana.jpg", width: 1200, height: 1600, alt: "Foto de Ana" } },
    { name: "Luis Gómez", role: "Secretario", photo: { url: "/src/assets/team/luis.jpg", width: 577, height: 1024, alt: "Foto de Luis" } },
  ],
  settings: { tagline: "Hecho por estudiantes", description: "Asociación de Computación.", about: "Somos la ASO." },
});

function createSeed(storage: InMemoryMediaStorage) {
  return new SeedLandingContentUseCase({
    events: new EventPrismaRepository(),
    faqs: new FaqPrismaRepository(),
    pillars: new PillarPrismaRepository(),
    socials: new SocialLinkPrismaRepository(),
    board: new BoardMemberPrismaRepository(),
    settings: new SiteSettingsPrismaRepository(),
    storage,
    readImage: async (path) => ({ name: path.split("/").at(-1)!, type: "image/jpeg", size: 3, arrayBuffer: async () => new ArrayBuffer(3) }),
  });
}

const rowCounts = async () => ({
  events: await prisma.event.count(),
  faqs: await prisma.faq.count(),
  pillars: await prisma.pillar.count(),
  socials: await prisma.socialLink.count(),
  board: await prisma.boardMember.count(),
  settings: await prisma.siteSettings.count(),
});

describe("landing content seed (integration)", () => {
  it("stores the content through the use cases and a second run changes nothing", async () => {
    const storage = new InMemoryMediaStorage();
    const seed = createSeed(storage);

    const first = await seed.apply(CONTENT);

    expect(first.failed).toBe(false);
    expect(await rowCounts()).toEqual({ events: 2, faqs: 1, pillars: 1, socials: 1, board: 2, settings: 1 });
    expect(storage.size).toBe(3);
    expect(await prisma.event.findUniqueOrThrow({ where: { slug: "semana" } })).toMatchObject({ datePrecision: "month", isPublished: true, highlights: ["FLISOL"] });
    expect(await prisma.boardMember.findMany({ orderBy: { sortOrder: "asc" } })).toMatchObject([
      { name: "Ana Pérez", isPublished: true, photoPublicId: "board/ana.jpg", photoAlt: "Foto de Ana" },
      { name: "Luis Gómez", isPublished: true, photoPublicId: "board/luis.jpg" },
    ]);

    const second = await seed.apply(CONTENT);

    expect(second.items.every((item) => item.outcome === "skipped")).toBe(true);
    expect(await rowCounts()).toEqual({ events: 2, faqs: 1, pillars: 1, socials: 1, board: 2, settings: 1 });
    expect(storage.size).toBe(3);
  });

  it("writes nothing on a dry run", async () => {
    const storage = new InMemoryMediaStorage();

    const plan = await createSeed(storage).plan(CONTENT);

    expect(plan.items.filter((item) => item.action === "create")).toHaveLength(8);
    expect(await rowCounts()).toEqual({ events: 0, faqs: 0, pillars: 0, socials: 0, board: 0, settings: 0 });
    expect(storage.size).toBe(0);
  });

  it("leaves an admin's edit alone", async () => {
    const seed = createSeed(new InMemoryMediaStorage());
    await seed.apply(CONTENT);
    await prisma.faq.updateMany({ data: { answer: "Editada por el admin." } });
    await prisma.boardMember.updateMany({ where: { name: "Luis Gómez" }, data: { isPublished: false } });

    await seed.apply(CONTENT);

    expect((await prisma.faq.findFirstOrThrow()).answer).toBe("Editada por el admin.");
    expect((await prisma.boardMember.findFirstOrThrow({ where: { name: "Luis Gómez" } })).isPublished).toBe(false);
  });
});
