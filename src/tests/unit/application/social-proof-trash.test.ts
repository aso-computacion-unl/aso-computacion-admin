import { beforeEach, describe, expect, it } from "vitest";

import type { TrashableRepository } from "@/application/ports/trashable-repository.port";
import { ListTrashUseCase } from "@/application/use-cases/list-trash.use-case";
import { PurgeContentUseCase, PurgeSponsorUseCase, PurgeTestimonialUseCase } from "@/application/use-cases/purge-content.use-case";
import { RestoreOrderedContentUseCase } from "@/application/use-cases/restore-content.use-case";
import { NotFoundError } from "@/application/use-cases/use-case-error";
import { ImpactStat } from "@/domain/impact-stat";
import { Sponsor } from "@/domain/sponsor";
import { Testimonial } from "@/domain/testimonial";
import { InMemoryMediaStorage } from "@/tests/fakes/in-memory-media-storage";
import { InMemoryOrderedRepository } from "@/tests/fakes/in-memory-ordered-repository";

const image = (name: string) => ({ url: `https://img.test/${name}.png`, publicId: `aso/${name}`, width: 800, height: 400, alt: name });
const stat = (sortOrder: number) => ImpactStat.create({ value: "120+", label: "Estudiantes", sortOrder });
const testimonial = (sortOrder: number, photo?: ReturnType<typeof image>) =>
  Testimonial.create({ quote: "Muy útil.", name: "Ana Pérez", role: "Egresada", sortOrder, photo });
const sponsor = (sortOrder: number, logo?: ReturnType<typeof image>) => Sponsor.create({ name: "Acme", sortOrder, logo });

describe("social proof in the trash", () => {
  let impact: InMemoryOrderedRepository<ImpactStat>;
  let testimonials: InMemoryOrderedRepository<Testimonial>;
  let sponsors: InMemoryOrderedRepository<Sponsor>;
  let storage: InMemoryMediaStorage;

  beforeEach(() => {
    impact = new InMemoryOrderedRepository();
    testimonials = new InMemoryOrderedRepository();
    sponsors = new InMemoryOrderedRepository();
    storage = new InMemoryMediaStorage();
  });

  it("lists the three kinds with a title each, newest deletion first", async () => {
    const [a, b, c] = [await impact.create(stat(0)), await testimonials.create(testimonial(0)), await sponsors.create(sponsor(0, image("acme")))];
    for (const [repository, id] of [[impact, a.props.id], [testimonials, b.props.id], [sponsors, c.props.id]] as const) {
      await repository.trash(id);
      await new Promise((resolve) => setTimeout(resolve, 2));
    }
    const none = () => ({ listTrashed: async () => [] }) as unknown as TrashableRepository<never>;

    const trash = await new ListTrashUseCase({ events: none(), news: none(), faqs: none(), commands: none(), socials: none(), pillars: none(), board: none(), impact, testimonials, sponsors }).execute();

    expect(trash.map(({ kind, title, id }) => [kind, title, id])).toEqual([
      ["sponsor", "Acme", c.props.id],
      ["testimonial", "Ana Pérez", b.props.id],
      ["impact", "120+ Estudiantes", a.props.id],
    ]);
  });

  it("purges an impact stat for good, refusing a live one", async () => {
    const live = await impact.create(stat(0));
    const gone = await impact.create(stat(1));
    await impact.trash(gone.props.id);
    const purge = new PurgeContentUseCase(impact, "Impact stat not found");

    await expect(purge.execute({ id: live.props.id })).rejects.toBeInstanceOf(NotFoundError);
    await purge.execute({ id: gone.props.id });

    expect(await impact.listTrashed()).toEqual([]);
    expect((await impact.list()).map((item) => item.props.id)).toEqual([live.props.id]);
  });

  it("purging a testimonial or a sponsor destroys its stored image only after the row is gone", async () => {
    const withPhoto = await testimonials.create(testimonial(0, image("ana")));
    const withLogo = await sponsors.create(sponsor(0, image("acme")));
    const plain = await testimonials.create(testimonial(1));
    for (const [repository, id] of [[testimonials, withPhoto.props.id], [sponsors, withLogo.props.id], [testimonials, plain.props.id]] as const) await repository.trash(id);

    await new PurgeTestimonialUseCase(testimonials, storage).execute({ id: withPhoto.props.id });
    await new PurgeSponsorUseCase(sponsors, storage).execute({ id: withLogo.props.id });
    await new PurgeTestimonialUseCase(testimonials, storage).execute({ id: plain.props.id });

    expect(storage.destroyedPublicIds).toEqual(["aso/ana", "aso/acme"]);
    expect(await testimonials.listTrashed()).toEqual([]);
  });

  it("keeps the image of an item that is still live when its purge is refused", async () => {
    const live = await sponsors.create(sponsor(0, image("acme")));

    await expect(new PurgeSponsorUseCase(sponsors, storage).execute({ id: live.props.id })).rejects.toBeInstanceOf(NotFoundError);

    expect(storage.destroyedPublicIds).toEqual([]);
  });

  it("restores an item as an unpublished draft at the end of the list", async () => {
    const a = await sponsors.create(sponsor(0, image("a")).withPublished(true));
    const b = await sponsors.create(sponsor(1, image("b")));
    await sponsors.trash(a.props.id);

    await new RestoreOrderedContentUseCase(sponsors, "Sponsor not found").execute({ id: a.props.id });

    expect((await sponsors.list()).map(({ props }) => [props.id, props.sortOrder, props.isPublished])).toEqual([
      [b.props.id, 1, false],
      [a.props.id, 2, false],
    ]);
  });
});
