import { beforeEach, describe, expect, it } from "vitest";

import { GetPublicSocialProofUseCase } from "@/application/use-cases/get-public-social-proof.use-case";
import { Sponsor } from "@/domain/sponsor";
import { InMemoryOrderedRepository } from "@/tests/fakes/in-memory-ordered-repository";

const image = (name: string) => ({ url: `https://res.cloudinary.test/${name}.png`, publicId: `aso/${name}`, width: 600, height: 300, alt: name });

describe("GetPublicSocialProofUseCase", () => {
  let sponsors: InMemoryOrderedRepository<Sponsor>;
  let useCase: GetPublicSocialProofUseCase;

  beforeEach(() => {
    sponsors = new InMemoryOrderedRepository();
    useCase = new GetPublicSocialProofUseCase(sponsors);
  });

  it("is empty when nothing was ever saved", async () => {
    expect(await useCase.execute()).toEqual({ sponsors: [] });
  });

  it("returns only the published sponsors", async () => {
    await sponsors.create(Sponsor.create({ name: "Publicado", sortOrder: 0, logo: image("a"), isPublished: true }));
    await sponsors.create(Sponsor.create({ name: "Borrador", sortOrder: 1, logo: image("b") }));

    const result = await useCase.execute();

    expect(result.sponsors.map((item) => item.name)).toEqual(["Publicado"]);
  });

  it("returns them in the order the admin set, not in creation order", async () => {
    await sponsors.create(Sponsor.create({ name: "Segundo", sortOrder: 1, logo: image("s2"), isPublished: true }));
    await sponsors.create(Sponsor.create({ name: "Primero", sortOrder: 0, logo: image("s1"), isPublished: true }));

    const result = await useCase.execute();

    expect(result.sponsors.map((item) => item.name)).toEqual(["Primero", "Segundo"]);
  });

  it("leaves out whatever is in the trash, even if it was published when deleted", async () => {
    const ally = await sponsors.create(Sponsor.create({ name: "Papelera", sortOrder: 0, logo: image("t"), isPublished: true }));
    await sponsors.trash(ally.props.id);

    const result = await useCase.execute();

    expect(result.sponsors).toEqual([]);
  });

  it("does not expose impact figures or testimonials any more", async () => {
    expect(Object.keys(await useCase.execute())).toEqual(["sponsors"]);
  });
});
