import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { Pillar } from "@/domain/pillar";
import { prisma } from "@/infrastructure/prisma/client";
import { PillarPrismaRepository } from "@/infrastructure/repositories/pillar-prisma.repository";

import { describeOrderedRepositoryContract } from "../support/ordered-repository-contract";

const repository = new PillarPrismaRepository();
const IMAGE = {
  url: "https://res.cloudinary.test/pillars/voz.jpg",
  publicId: "pillars/voz",
  width: 1600,
  height: 900,
  alt: "Público en una charla",
};
const make = (sortOrder: number) =>
  Pillar.create({ word: "VOZ", title: `Pilar ${crypto.randomUUID().slice(0, 8)}`, text: "Texto", sortOrder });

describeOrderedRepositoryContract("PillarPrismaRepository", repository, make);

describe("PillarPrismaRepository (integration)", () => {
  it("round-trips a pillar without an image and with one", async () => {
    const bare = make(0);
    const withImage = Pillar.create({ word: "EVENTOS", title: "Organizamos", text: "ñ".repeat(300), sortOrder: 1, isPublished: true, image: IMAGE });

    await repository.create(bare);
    await repository.create(withImage);

    expect((await repository.getById(bare.props.id))?.props).toEqual(bare.props);
    expect((await repository.getById(withImage.props.id))?.props).toEqual(withImage.props);
  });

  it("sets, replaces and clears the image through update", async () => {
    const created = await repository.create(make(0));

    const withImage = await repository.update(created.withImage(IMAGE));
    expect((await repository.getById(created.props.id))?.props.image).toEqual(IMAGE);

    const replaced = await repository.update(withImage.withImage({ ...IMAGE, publicId: "pillars/otra", alt: "Otra" }));
    expect((await repository.getById(created.props.id))?.props.image).toMatchObject({ publicId: "pillars/otra", alt: "Otra" });

    await repository.update(replaced.withoutImage());
    expect((await repository.getById(created.props.id))?.props.image).toBeNull();
  });

  it("refuses, in the database, an image with only some of its columns", async () => {
    const half = { id: crypto.randomUUID(), word: "VOZ", title: "Medio", text: "Texto", sortOrder: 0, updatedAt: new Date() };

    await expect(prisma.pillar.create({ data: { ...half, imageUrl: "https://x.test/a.jpg" } })).rejects.toThrow();
    await expect(prisma.pillar.create({ data: { ...half, imageAlt: "solo alt" } })).rejects.toThrow();
  });
});
