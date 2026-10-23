import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { SocialLink } from "@/domain/social-link";
import { SocialLinkPrismaRepository } from "@/infrastructure/repositories/social-link-prisma.repository";

import { describeOrderedRepositoryContract } from "../support/ordered-repository-contract";

const repository = new SocialLinkPrismaRepository();
const make = (sortOrder: number) =>
  SocialLink.create({
    platform: "instagram",
    label: `Instagram ${crypto.randomUUID().slice(0, 8)}`,
    handle: "@aso_computacion",
    url: "https://www.instagram.com/aso_computacion/",
    sortOrder,
  });

describeOrderedRepositoryContract("SocialLinkPrismaRepository", repository, make);

describe("SocialLinkPrismaRepository (integration)", () => {
  it("round-trips the optional chips, set and cleared", async () => {
    const link = SocialLink.create({
      platform: "linkedin",
      label: "LinkedIn",
      handle: "ASO Computación",
      url: "https://www.linkedin.com/company/aso-computacion-unl/",
      note: "Anunciamos primero aquí",
      blurb: "Eventos, fotos y anuncios.",
      sortOrder: 0,
      isPublished: true,
    });

    await repository.create(link);
    expect((await repository.getById(link.props.id))?.props).toEqual(link.props);

    const cleared = await repository.update(link.update({ note: "", blurb: "" }));
    expect((await repository.getById(link.props.id))?.props).toEqual(cleared.props);
    expect(cleared.props).toMatchObject({ note: null, blurb: null });
  });
});
