import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { prisma } from "@/infrastructure/prisma/client";

const NOW = new Date("2026-10-26T12:00:00.000Z");
const base = (overrides: Record<string, unknown> = {}) => ({ id: crypto.randomUUID(), sortOrder: 0, updatedAt: NOW, ...overrides });
const image = (prefix: string, publicId = `${prefix}/a`) => ({
  [`${prefix}Url`]: `https://res.cloudinary.test/${publicId}.jpg`,
  [`${prefix}PublicId`]: publicId,
  [`${prefix}Width`]: 400,
  [`${prefix}Height`]: 400,
  [`${prefix}Alt`]: "Alt",
});

describe("social proof schema (integration)", () => {
  it("stores impact stats unpublished and live by default", async () => {
    expect(await prisma.impactStat.create({ data: base({ value: "120+", label: "Estudiantes" }) })).toMatchObject({ isPublished: false, deletedAt: null });
  });

  it("refuses a trashed row that is still published, in every table", async () => {
    const trashed = { deletedAt: NOW, isPublished: true };

    await expect(prisma.impactStat.create({ data: base({ value: "1", label: "x", ...trashed }) })).rejects.toThrow();
    await expect(prisma.testimonial.create({ data: base({ quote: "q", name: "n", role: "r", ...trashed }) })).rejects.toThrow();
    await expect(prisma.sponsor.create({ data: base({ name: "n", ...image("logo"), ...trashed }) })).rejects.toThrow();
  });

  it("refuses a photo or a logo with only some of its columns", async () => {
    const testimonial = base({ quote: "q", name: "n", role: "r" });
    const sponsor = base({ name: "n" });

    await expect(prisma.testimonial.create({ data: { ...testimonial, photoUrl: "https://x.test/a.jpg" } })).rejects.toThrow();
    await expect(prisma.testimonial.create({ data: { ...testimonial, photoAlt: "solo alt" } })).rejects.toThrow();
    await expect(prisma.sponsor.create({ data: { ...sponsor, logoUrl: "https://x.test/a.jpg" } })).rejects.toThrow();
  });

  it("accepts a testimonial with no photo, published", async () => {
    await expect(prisma.testimonial.create({ data: base({ quote: "q", name: "n", role: "r", isPublished: true }) })).resolves.toBeTruthy();
  });

  it("refuses a published sponsor without a logo and accepts it with one", async () => {
    await expect(prisma.sponsor.create({ data: base({ name: "Sin logo", isPublished: true }) })).rejects.toThrow();
    await expect(prisma.sponsor.create({ data: base({ name: "Con logo", isPublished: true, ...image("logo") }) })).resolves.toBeTruthy();
  });

  it("keeps a stored asset unique across rows", async () => {
    await prisma.sponsor.create({ data: base({ name: "A", ...image("logo", "sponsors/x") }) });

    await expect(prisma.sponsor.create({ data: base({ name: "B", ...image("logo", "sponsors/x") }) })).rejects.toThrow();
  });
});
