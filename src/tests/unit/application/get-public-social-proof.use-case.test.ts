import { beforeEach, describe, expect, it } from "vitest";

import { GetPublicSocialProofUseCase } from "@/application/use-cases/get-public-social-proof.use-case";
import { ImpactStat } from "@/domain/impact-stat";
import { Sponsor } from "@/domain/sponsor";
import { Testimonial } from "@/domain/testimonial";
import { InMemoryOrderedRepository } from "@/tests/fakes/in-memory-ordered-repository";

const image = (name: string) => ({ url: `https://res.cloudinary.test/${name}.png`, publicId: `aso/${name}`, width: 600, height: 300, alt: name });

describe("GetPublicSocialProofUseCase", () => {
  let impact: InMemoryOrderedRepository<ImpactStat>;
  let testimonials: InMemoryOrderedRepository<Testimonial>;
  let sponsors: InMemoryOrderedRepository<Sponsor>;
  let useCase: GetPublicSocialProofUseCase;

  beforeEach(() => {
    impact = new InMemoryOrderedRepository();
    testimonials = new InMemoryOrderedRepository();
    sponsors = new InMemoryOrderedRepository();
    useCase = new GetPublicSocialProofUseCase(impact, testimonials, sponsors);
  });

  it("is empty when nothing was ever saved", async () => {
    expect(await useCase.execute()).toEqual({ impact: [], testimonials: [], sponsors: [] });
  });

  it("returns only the published items of each kind", async () => {
    await impact.create(ImpactStat.create({ value: "1", label: "Publicada", sortOrder: 0, isPublished: true }));
    await impact.create(ImpactStat.create({ value: "2", label: "Borrador", sortOrder: 1 }));
    await testimonials.create(Testimonial.create({ quote: "q", name: "Publicado", role: "r", sortOrder: 0, isPublished: true }));
    await testimonials.create(Testimonial.create({ quote: "q", name: "Borrador", role: "r", sortOrder: 1 }));
    await sponsors.create(Sponsor.create({ name: "Publicado", sortOrder: 0, logo: image("a"), isPublished: true }));
    await sponsors.create(Sponsor.create({ name: "Borrador", sortOrder: 1, logo: image("b") }));

    const result = await useCase.execute();

    expect(result.impact.map((stat) => stat.label)).toEqual(["Publicada"]);
    expect(result.testimonials.map((item) => item.name)).toEqual(["Publicado"]);
    expect(result.sponsors.map((item) => item.name)).toEqual(["Publicado"]);
  });

  it("returns them in the order the admin set, not in creation order", async () => {
    await impact.create(ImpactStat.create({ value: "3", label: "C", sortOrder: 2, isPublished: true }));
    await impact.create(ImpactStat.create({ value: "1", label: "A", sortOrder: 0, isPublished: true }));
    await testimonials.create(Testimonial.create({ quote: "q", name: "Segundo", role: "r", sortOrder: 1, isPublished: true }));
    await testimonials.create(Testimonial.create({ quote: "q", name: "Primero", role: "r", sortOrder: 0, isPublished: true }));
    await sponsors.create(Sponsor.create({ name: "Segundo", sortOrder: 1, logo: image("s2"), isPublished: true }));
    await sponsors.create(Sponsor.create({ name: "Primero", sortOrder: 0, logo: image("s1"), isPublished: true }));

    const result = await useCase.execute();

    expect(result.impact.map((stat) => stat.label)).toEqual(["A", "C"]);
    expect(result.testimonials.map((item) => item.name)).toEqual(["Primero", "Segundo"]);
    expect(result.sponsors.map((item) => item.name)).toEqual(["Primero", "Segundo"]);
  });

  it("leaves out whatever is in the trash, even if it was published when deleted", async () => {
    const stat = await impact.create(ImpactStat.create({ value: "1", label: "Vive", sortOrder: 0, isPublished: true }));
    const gone = await impact.create(ImpactStat.create({ value: "2", label: "Papelera", sortOrder: 1, isPublished: true }));
    const quote = await testimonials.create(Testimonial.create({ quote: "q", name: "Papelera", role: "r", sortOrder: 0, isPublished: true }));
    const ally = await sponsors.create(Sponsor.create({ name: "Papelera", sortOrder: 0, logo: image("t"), isPublished: true }));
    await impact.trash(gone.props.id);
    await testimonials.trash(quote.props.id);
    await sponsors.trash(ally.props.id);

    const result = await useCase.execute();

    expect(result.impact.map((item) => item.id)).toEqual([stat.props.id]);
    expect(result.testimonials).toEqual([]);
    expect(result.sponsors).toEqual([]);
  });
});
