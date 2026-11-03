import { beforeEach, describe, expect, it } from "vitest";

import type { TrashableRepository } from "@/application/ports/trashable-repository.port";
import { ListTrashUseCase } from "@/application/use-cases/list-trash.use-case";
import { PurgeSponsorUseCase } from "@/application/use-cases/purge-content.use-case";
import { RestoreOrderedContentUseCase } from "@/application/use-cases/restore-content.use-case";
import { NotFoundError } from "@/application/use-cases/use-case-error";
import { Sponsor } from "@/domain/sponsor";
import { InMemoryMediaStorage } from "@/tests/fakes/in-memory-media-storage";
import { InMemoryOrderedRepository } from "@/tests/fakes/in-memory-ordered-repository";

const image = (name: string) => ({ url: `https://img.test/${name}.png`, publicId: `aso/${name}`, width: 800, height: 400, alt: name });
const sponsor = (sortOrder: number, logo?: ReturnType<typeof image>) => Sponsor.create({ name: "Acme", sortOrder, logo });

describe("sponsors in the trash", () => {
  let sponsors: InMemoryOrderedRepository<Sponsor>;
  let storage: InMemoryMediaStorage;

  beforeEach(() => {
    sponsors = new InMemoryOrderedRepository();
    storage = new InMemoryMediaStorage();
  });

  it("lists a sponsor with its name as title", async () => {
    const acme = await sponsors.create(sponsor(0, image("acme")));
    await sponsors.trash(acme.props.id);
    const none = () => ({ listTrashed: async () => [] }) as unknown as TrashableRepository<never>;

    const trash = await new ListTrashUseCase({ events: none(), news: none(), faqs: none(), commands: none(), socials: none(), pillars: none(), board: none(), sponsors }).execute();

    expect(trash.map(({ kind, title, id }) => [kind, title, id])).toEqual([["sponsor", "Acme", acme.props.id]]);
  });

  it("purging a sponsor destroys its stored image only after the row is gone", async () => {
    const withLogo = await sponsors.create(sponsor(0, image("acme")));
    await sponsors.trash(withLogo.props.id);

    await new PurgeSponsorUseCase(sponsors, storage).execute({ id: withLogo.props.id });

    expect(storage.destroyedPublicIds).toEqual(["aso/acme"]);
    expect(await sponsors.listTrashed()).toEqual([]);
  });

  it("purging a sponsor without a logo destroys nothing", async () => {
    const plain = await sponsors.create(sponsor(0));
    await sponsors.trash(plain.props.id);

    await new PurgeSponsorUseCase(sponsors, storage).execute({ id: plain.props.id });

    expect(await sponsors.listTrashed()).toEqual([]);
    expect(storage.destroyedPublicIds).toEqual([]);
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
