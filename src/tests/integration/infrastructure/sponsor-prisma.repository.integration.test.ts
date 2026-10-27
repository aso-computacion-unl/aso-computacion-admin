import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { Sponsor } from "@/domain/sponsor";
import { SponsorPrismaRepository } from "@/infrastructure/repositories/sponsor-prisma.repository";

import { describeOrderedRepositoryContract } from "../support/ordered-repository-contract";

const repository = new SponsorPrismaRepository();
const LOGO = { url: "https://res.cloudinary.test/sponsors/acme.png", publicId: "sponsors/acme", width: 400, height: 200, alt: "Logotipo de Acme" };
const bare = (sortOrder: number) => Sponsor.create({ name: `Acme ${crypto.randomUUID().slice(0, 8)}`, sortOrder });
// The shared contract publishes what `make` builds, and a sponsor needs a logo to be published; publicId is unique.
const make = (sortOrder: number) => bare(sortOrder).withLogo({ ...LOGO, publicId: `sponsors/${crypto.randomUUID()}` });

describeOrderedRepositoryContract("SponsorPrismaRepository", repository, make);

describe("SponsorPrismaRepository (integration)", () => {
  it("round-trips a sponsor without a logo and a published one with a logo and a link", async () => {
    const draft = bare(0);
    const published = Sponsor.create({ name: "Ñandú S.A.", sortOrder: 1, url: "https://nandu.test/aliados", logo: LOGO, isPublished: true });

    await repository.create(draft);
    await repository.create(published);

    expect((await repository.getById(draft.props.id))?.props).toEqual(draft.props);
    expect((await repository.getById(published.props.id))?.props).toEqual(published.props);
  });

  it("sets, replaces and clears the logo through update; clearing unpublishes", async () => {
    const created = await repository.create(bare(0));

    const withLogo = await repository.update(created.withLogo(LOGO).withPublished(true));
    const replaced = await repository.update(withLogo.withLogo({ ...LOGO, publicId: "sponsors/otra", alt: "Otra" }));
    expect((await repository.getById(created.props.id))?.props.logo).toMatchObject({ publicId: "sponsors/otra", alt: "Otra" });

    await repository.update(replaced.withoutLogo());
    expect((await repository.getById(created.props.id))?.props).toMatchObject({ logo: null, isPublished: false });
  });
});
