import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { BoardMember } from "@/domain/board-member";
import { prisma } from "@/infrastructure/prisma/client";
import { BoardMemberPrismaRepository } from "@/infrastructure/repositories/board-member-prisma.repository";

import { describeOrderedRepositoryContract } from "../support/ordered-repository-contract";

const repository = new BoardMemberPrismaRepository();
const PHOTO = {
  url: "https://res.cloudinary.test/board/ana.jpg",
  publicId: "board/ana",
  width: 1200,
  height: 1600,
  alt: "Ana, presidenta",
};
const name = () => `Integrante ${crypto.randomUUID().slice(0, 8)}`;
const bare = (sortOrder: number) => BoardMember.create({ name: name(), role: "Vocal", sortOrder });
// The shared contract publishes what `make` builds, and a member needs a photo to be published; publicId is unique.
const make = (sortOrder: number) =>
  BoardMember.create({ name: name(), role: "Vocal", sortOrder, photo: { ...PHOTO, publicId: `board/${crypto.randomUUID()}` } });

describeOrderedRepositoryContract("BoardMemberPrismaRepository", repository, make);

describe("BoardMemberPrismaRepository (integration)", () => {
  it("round-trips a member without a photo and with one", async () => {
    const withoutPhoto = bare(0);
    const withPhoto = BoardMember.create({ name: "Ñandú Pérez", role: "Presidenta", sortOrder: 1, isPublished: true, photo: PHOTO });

    await repository.create(withoutPhoto);
    await repository.create(withPhoto);

    expect((await repository.getById(withoutPhoto.props.id))?.props).toEqual(withoutPhoto.props);
    expect((await repository.getById(withPhoto.props.id))?.props).toEqual(withPhoto.props);
  });

  it("sets, replaces and clears the photo through update", async () => {
    const created = await repository.create(bare(0));

    const withPhoto = await repository.update(created.withPhoto(PHOTO));
    expect((await repository.getById(created.props.id))?.props.photo).toEqual(PHOTO);

    const replaced = await repository.update(withPhoto.withPhoto({ ...PHOTO, publicId: "board/otra", alt: "Otra" }));
    expect((await repository.getById(created.props.id))?.props.photo).toMatchObject({ publicId: "board/otra", alt: "Otra" });

    await repository.update(replaced.withoutPhoto());
    expect((await repository.getById(created.props.id))?.props.photo).toBeNull();
  });

  it("refuses, in the database, a photo with only some of its columns", async () => {
    const half = { id: crypto.randomUUID(), name: "Medio", role: "Vocal", sortOrder: 0, updatedAt: new Date() };

    await expect(prisma.boardMember.create({ data: { ...half, photoUrl: "https://x.test/a.jpg" } })).rejects.toThrow();
    await expect(prisma.boardMember.create({ data: { ...half, photoAlt: "solo alt" } })).rejects.toThrow();
  });

  it("refuses, in the database, a published member without a photo", async () => {
    const base = { id: crypto.randomUUID(), name: "Sin foto", role: "Vocal", sortOrder: 0, updatedAt: new Date() };

    await expect(prisma.boardMember.create({ data: { ...base, isPublished: true } })).rejects.toThrow();
    await expect(prisma.boardMember.create({ data: { ...base, isPublished: false } })).resolves.toBeTruthy();
  });
});
