import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { prisma } from "@/infrastructure/prisma/client";

const NOW = new Date("2026-10-26T12:00:00.000Z");
const common = () => ({ id: crypto.randomUUID(), sortOrder: 0, updatedAt: NOW });
const stat = (extra: { isPublished?: boolean; deletedAt?: Date } = {}) => ({ ...common(), value: "120+", label: "Estudiantes", ...extra });
const testimonial = (extra: { isPublished?: boolean; deletedAt?: Date; photoUrl?: string; photoAlt?: string } = {}) => ({ ...common(), quote: "q", name: "n", role: "r", ...extra });
const logo = (publicId = "sponsors/a") => ({ logoUrl: `https://res.cloudinary.test/${publicId}.png`, logoPublicId: publicId, logoWidth: 400, logoHeight: 200, logoAlt: "Alt" });
const sponsor = (extra: { isPublished?: boolean; deletedAt?: Date; logoUrl?: string; logoPublicId?: string; logoWidth?: number; logoHeight?: number; logoAlt?: string } = {}) => ({ ...common(), name: "n", ...extra });

describe("social proof schema (integration)", () => {
  it("stores impact stats unpublished and live by default", async () => {
    expect(await prisma.impactStat.create({ data: stat() })).toMatchObject({ isPublished: false, deletedAt: null });
  });

  it("refuses a trashed row that is still published, in every table", async () => {
    const trashed = { deletedAt: NOW, isPublished: true };

    await expect(prisma.impactStat.create({ data: stat(trashed) })).rejects.toThrow();
    await expect(prisma.testimonial.create({ data: testimonial(trashed) })).rejects.toThrow();
    await expect(prisma.sponsor.create({ data: sponsor({ ...logo(), ...trashed }) })).rejects.toThrow();
  });

  it("refuses a photo or a logo with only some of its columns", async () => {
    await expect(prisma.testimonial.create({ data: testimonial({ photoUrl: "https://x.test/a.jpg" }) })).rejects.toThrow();
    await expect(prisma.testimonial.create({ data: testimonial({ photoAlt: "solo alt" }) })).rejects.toThrow();
    await expect(prisma.sponsor.create({ data: sponsor({ logoUrl: "https://x.test/a.jpg" }) })).rejects.toThrow();
  });

  it("accepts a testimonial with no photo, published", async () => {
    await expect(prisma.testimonial.create({ data: testimonial({ isPublished: true }) })).resolves.toBeTruthy();
  });

  it("refuses a published sponsor without a logo and accepts it with one", async () => {
    await expect(prisma.sponsor.create({ data: sponsor({ isPublished: true }) })).rejects.toThrow();
    await expect(prisma.sponsor.create({ data: sponsor({ isPublished: true, ...logo() }) })).resolves.toBeTruthy();
  });

  it("keeps a stored asset unique across rows", async () => {
    await prisma.sponsor.create({ data: sponsor(logo("sponsors/x")) });

    await expect(prisma.sponsor.create({ data: sponsor(logo("sponsors/x")) })).rejects.toThrow();
  });
});
