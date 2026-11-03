import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { GetPublicSocialProofUseCase } from "@/application/use-cases/get-public-social-proof.use-case";
import { RestoreOrderedContentUseCase } from "@/application/use-cases/restore-content.use-case";
import { Sponsor } from "@/domain/sponsor";
import { SponsorPrismaRepository } from "@/infrastructure/repositories/sponsor-prisma.repository";
import { toPublicSocialProof } from "@/interface/public/public-social-proof.mapper";

const sponsors = new SponsorPrismaRepository();
const useCase = new GetPublicSocialProofUseCase(sponsors);

const logo = (name: string) => ({ url: `https://res.cloudinary.test/${name}.png`, publicId: `sponsors/${name}-${crypto.randomUUID()}`, width: 400, height: 200, alt: name });

describe("public social proof (integration)", () => {
  it("returns only published, non-trashed sponsors, in the order the admin set", async () => {
    await sponsors.create(Sponsor.create({ name: "Segundo", sortOrder: 1, logo: logo("b"), isPublished: true }));
    await sponsors.create(Sponsor.create({ name: "Primero", sortOrder: 0, logo: logo("a"), isPublished: true }));
    await sponsors.create(Sponsor.create({ name: "Borrador", sortOrder: 2, logo: logo("c") }));

    const result = await useCase.execute();

    expect(result.sponsors.map((item) => item.name)).toEqual(["Primero", "Segundo"]);
  });

  it("drops an item the moment it is trashed and keeps it out after a restore until it is published again", async () => {
    const ally = await sponsors.create(Sponsor.create({ name: "Acme", sortOrder: 0, logo: logo("acme"), isPublished: true }));

    await sponsors.trash(ally.props.id);

    expect(await useCase.execute()).toMatchObject({ sponsors: [] });

    await new RestoreOrderedContentUseCase(sponsors, "Sponsor not found").execute({ id: ally.props.id });

    expect((await useCase.execute()).sponsors).toEqual([]);
    expect((await sponsors.getById(ally.props.id))?.props.isPublished).toBe(false);
  });

  it("serializes to the public shape with no id, storage id, flag or timestamp", async () => {
    await sponsors.create(Sponsor.create({ name: "Acme", sortOrder: 0, url: "https://acme.test", logo: logo("acme"), isPublished: true }));

    const json = JSON.stringify(toPublicSocialProof(await useCase.execute()));

    expect(JSON.parse(json)).toEqual({
      sponsors: [{ name: "Acme", logo: { url: "https://res.cloudinary.test/acme.png", width: 400, height: 200, alt: "acme" }, url: "https://acme.test" }],
    });
    expect(json).not.toMatch(/publicId|isPublished|sortOrder|createdAt|updatedAt|deletedAt|"id"/);
  });
});
