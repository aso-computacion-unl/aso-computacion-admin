import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { Testimonial } from "@/domain/testimonial";
import { prisma } from "@/infrastructure/prisma/client";
import { TestimonialPrismaRepository } from "@/infrastructure/repositories/testimonial-prisma.repository";

import { describeOrderedRepositoryContract } from "../support/ordered-repository-contract";

const repository = new TestimonialPrismaRepository();
const PHOTO = { url: "https://res.cloudinary.test/testimonials/ana.jpg", publicId: "testimonials/ana", width: 600, height: 600, alt: "Ana sonriendo" };
const bare = (sortOrder: number) => Testimonial.create({ quote: "Muy útil.", name: `Ana ${crypto.randomUUID().slice(0, 8)}`, role: "Egresada", sortOrder });
// The photo is optional, but its publicId is unique across rows.
const make = (sortOrder: number) => bare(sortOrder).withPhoto({ ...PHOTO, publicId: `testimonials/${crypto.randomUUID()}` });

describeOrderedRepositoryContract("TestimonialPrismaRepository", repository, make);

describe("TestimonialPrismaRepository (integration)", () => {
  it("round-trips a testimonial without a photo and with one, published", async () => {
    const withoutPhoto = Testimonial.create({ quote: "Ñandú «increíble»", name: "Ñandú Pérez", role: "Docente", sortOrder: 0, isPublished: true });
    const withPhoto = bare(1).withPhoto(PHOTO);

    await repository.create(withoutPhoto);
    await repository.create(withPhoto);

    expect((await repository.getById(withoutPhoto.props.id))?.props).toEqual(withoutPhoto.props);
    expect((await repository.getById(withPhoto.props.id))?.props).toEqual(withPhoto.props);
  });

  it("sets, replaces and clears the photo through update, staying published", async () => {
    const created = await repository.create(bare(0).withPublished(true));

    const withPhoto = await repository.update(created.withPhoto(PHOTO));
    const replaced = await repository.update(withPhoto.withPhoto({ ...PHOTO, publicId: "testimonials/otra", alt: "Otra" }));
    expect((await repository.getById(created.props.id))?.props.photo).toMatchObject({ publicId: "testimonials/otra", alt: "Otra" });

    await repository.update(replaced.withoutPhoto());
    expect((await repository.getById(created.props.id))?.props).toMatchObject({ photo: null, isPublished: true });
  });

  it("refuses, in the database, a published-then-trashed row left published", async () => {
    const { id } = (await repository.create(bare(0).withPublished(true))).props;

    await expect(prisma.testimonial.update({ where: { id }, data: { deletedAt: new Date() } })).rejects.toThrow();
  });
});
