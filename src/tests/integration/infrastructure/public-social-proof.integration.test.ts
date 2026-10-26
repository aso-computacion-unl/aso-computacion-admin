import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { GetPublicSocialProofUseCase } from "@/application/use-cases/get-public-social-proof.use-case";
import { RestoreOrderedContentUseCase } from "@/application/use-cases/restore-content.use-case";
import { ImpactStat } from "@/domain/impact-stat";
import { Sponsor } from "@/domain/sponsor";
import { Testimonial } from "@/domain/testimonial";
import { ImpactStatPrismaRepository } from "@/infrastructure/repositories/impact-stat-prisma.repository";
import { SponsorPrismaRepository } from "@/infrastructure/repositories/sponsor-prisma.repository";
import { TestimonialPrismaRepository } from "@/infrastructure/repositories/testimonial-prisma.repository";
import { toPublicSocialProof } from "@/interface/public/public-social-proof.mapper";

const impact = new ImpactStatPrismaRepository();
const testimonials = new TestimonialPrismaRepository();
const sponsors = new SponsorPrismaRepository();
const useCase = new GetPublicSocialProofUseCase(impact, testimonials, sponsors);

const logo = (name: string) => ({ url: `https://res.cloudinary.test/${name}.png`, publicId: `sponsors/${name}-${crypto.randomUUID()}`, width: 400, height: 200, alt: name });

describe("public social proof (integration)", () => {
  it("returns only published, non-trashed items, in the order the admin set", async () => {
    await impact.create(ImpactStat.create({ value: "3", label: "Tercera", sortOrder: 2, isPublished: true }));
    await impact.create(ImpactStat.create({ value: "1", label: "Primera", sortOrder: 0, isPublished: true }));
    await impact.create(ImpactStat.create({ value: "2", label: "Borrador", sortOrder: 1 }));
    await testimonials.create(Testimonial.create({ quote: "q", name: "Segundo", role: "r", sortOrder: 1, isPublished: true }));
    await testimonials.create(Testimonial.create({ quote: "q", name: "Primero", role: "r", sortOrder: 0, isPublished: true }));
    await testimonials.create(Testimonial.create({ quote: "q", name: "Borrador", role: "r", sortOrder: 2 }));
    await sponsors.create(Sponsor.create({ name: "Segundo", sortOrder: 1, logo: logo("b"), isPublished: true }));
    await sponsors.create(Sponsor.create({ name: "Primero", sortOrder: 0, logo: logo("a"), isPublished: true }));
    await sponsors.create(Sponsor.create({ name: "Borrador", sortOrder: 2, logo: logo("c") }));

    const result = await useCase.execute();

    expect(result.impact.map((item) => item.label)).toEqual(["Primera", "Tercera"]);
    expect(result.testimonials.map((item) => item.name)).toEqual(["Primero", "Segundo"]);
    expect(result.sponsors.map((item) => item.name)).toEqual(["Primero", "Segundo"]);
  });

  it("drops an item the moment it is trashed and keeps it out after a restore until it is published again", async () => {
    const stat = await impact.create(ImpactStat.create({ value: "1", label: "Vive", sortOrder: 0, isPublished: true }));
    const quote = await testimonials.create(Testimonial.create({ quote: "q", name: "Ana", role: "r", sortOrder: 0, isPublished: true }));
    const ally = await sponsors.create(Sponsor.create({ name: "Acme", sortOrder: 0, logo: logo("acme"), isPublished: true }));

    await impact.trash(stat.props.id);
    await testimonials.trash(quote.props.id);
    await sponsors.trash(ally.props.id);

    expect(await useCase.execute()).toMatchObject({ impact: [], testimonials: [], sponsors: [] });

    await new RestoreOrderedContentUseCase(sponsors, "Sponsor not found").execute({ id: ally.props.id });

    expect((await useCase.execute()).sponsors).toEqual([]);
    expect((await sponsors.getById(ally.props.id))?.props.isPublished).toBe(false);
  });

  it("serializes to the public shape with no id, storage id, flag or timestamp", async () => {
    await testimonials.create(Testimonial.create({ quote: "Muy útil.", name: "Ana", role: "Egresada", sortOrder: 0, isPublished: true }));
    await sponsors.create(Sponsor.create({ name: "Acme", sortOrder: 0, url: "https://acme.test", logo: logo("acme"), isPublished: true }));

    const json = JSON.stringify(toPublicSocialProof(await useCase.execute()));

    expect(JSON.parse(json)).toEqual({
      impact: [],
      testimonials: [{ quote: "Muy útil.", name: "Ana", role: "Egresada", photo: null }],
      sponsors: [{ name: "Acme", logo: { url: "https://res.cloudinary.test/acme.png", width: 400, height: 200, alt: "acme" }, url: "https://acme.test" }],
    });
    expect(json).not.toMatch(/publicId|isPublished|sortOrder|createdAt|updatedAt|deletedAt|"id"/);
  });
});
