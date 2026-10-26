import { describe, expect, it } from "vitest";

import type { OrderedContent, OrderedContentRepository } from "@/application/ports/ordered-content-repository.port";

const MISSING_ID = "00000000-0000-0000-0000-000000000000";
const wait = () => new Promise((resolve) => setTimeout(resolve, 5));

/**
 * Behaviour every Prisma repository behind an admin-ordered list must show.
 * `make` builds a fresh unsaved entity for a position; the repository runs
 * against the real test database (tables are wiped before each test).
 */
export function describeOrderedRepositoryContract<E extends OrderedContent<E>>(
  name: string,
  repository: OrderedContentRepository<E>,
  make: (sortOrder: number) => E,
) {
  const idsOf = async () => (await repository.list()).map((item) => item.props.id);

  describe(`${name}: ordered repository contract`, () => {
    it("round-trips an entity and returns null for an unknown id", async () => {
      const entity = make(0);

      await repository.create(entity);

      expect((await repository.getById(entity.props.id))?.props).toEqual(entity.props);
      expect(await repository.getById(MISSING_ID)).toBeNull();
    });

    it("lists drafts too: sortOrder ascending, then oldest first", async () => {
      const late = await repository.create(make(2));
      const firstTie = await repository.create(make(1));
      await wait();
      const secondTie = await repository.create(make(1));

      expect(await idsOf()).toEqual([firstTie, secondTie, late].map((item) => item.props.id));
    });

    it("updates an entity, keeping its id and creation time", async () => {
      const created = await repository.create(make(0));

      const updated = await repository.update(created.withPublished(true));

      expect(updated.props).toMatchObject({ id: created.props.id, isPublished: true });
      expect(updated.props.createdAt).toEqual(created.props.createdAt);
    });

    it("throws NotFoundError when updating or deleting an unknown entity", async () => {
      await expect(repository.update(make(0))).rejects.toMatchObject({ name: "NotFoundError" });
      await expect(repository.delete(MISSING_ID)).rejects.toMatchObject({ name: "NotFoundError" });
    });

    it("deletes an entity", async () => {
      const entity = await repository.create(make(0));

      await repository.delete(entity.props.id);

      expect(await repository.getById(entity.props.id)).toBeNull();
    });

    it("trash hides a published row from reads, unpublishes it, and lists it newest deletion first", async () => {
      const first = await repository.create(make(0).withPublished(true));
      const second = await repository.create(make(1));
      const kept = await repository.create(make(2));

      await repository.trash(first.props.id);
      await wait();
      await repository.trash(second.props.id);

      expect(await idsOf()).toEqual([kept.props.id]);
      expect(await repository.getById(first.props.id)).toBeNull();
      const trashed = await repository.listTrashed();
      expect(trashed.map((item) => item.entity.props.id)).toEqual([second.props.id, first.props.id]);
      expect(trashed.map((item) => item.entity.props.isPublished)).toEqual([false, false]);
      expect((await repository.getTrashed(first.props.id))?.deletedAt).toBeInstanceOf(Date);
      expect(await repository.getTrashed(kept.props.id)).toBeNull();
    });

    it("trash throws NotFoundError for an unknown or already trashed row and changes nothing", async () => {
      const entity = await repository.create(make(0));
      await repository.trash(entity.props.id);
      const before = await repository.getTrashed(entity.props.id);

      await expect(repository.trash(entity.props.id)).rejects.toMatchObject({ name: "NotFoundError" });
      await expect(repository.trash(MISSING_ID)).rejects.toMatchObject({ name: "NotFoundError" });

      expect(await repository.getTrashed(entity.props.id)).toEqual(before);
    });

    it("restore makes a trashed row live again with the state it is given, and leaves the trash", async () => {
      const [a, b] = [await repository.create(make(0)), await repository.create(make(1))];
      await repository.trash(a.props.id);

      const restored = await repository.restore(a.withSortOrder(5));

      expect(restored.props).toMatchObject({ id: a.props.id, sortOrder: 5, isPublished: false });
      expect(await idsOf()).toEqual([b.props.id, a.props.id]);
      expect(await repository.listTrashed()).toEqual([]);
    });

    it("restore throws NotFoundError for a live or unknown row and changes nothing", async () => {
      const live = await repository.create(make(0));

      await expect(repository.restore(live.withSortOrder(9))).rejects.toMatchObject({ name: "NotFoundError" });
      await expect(repository.restore(make(0))).rejects.toMatchObject({ name: "NotFoundError" });

      expect((await repository.getById(live.props.id))?.props.sortOrder).toBe(0);
    });

    it("purge removes only a trashed row; a live or unknown one throws NotFoundError and stays", async () => {
      const live = await repository.create(make(0));
      const trashed = await repository.create(make(1));
      await repository.trash(trashed.props.id);

      await expect(repository.purge(live.props.id)).rejects.toMatchObject({ name: "NotFoundError" });
      await expect(repository.purge(MISSING_ID)).rejects.toMatchObject({ name: "NotFoundError" });
      expect(await idsOf()).toEqual([live.props.id]);

      await repository.purge(trashed.props.id);

      expect(await repository.getTrashed(trashed.props.id)).toBeNull();
      expect(await repository.listTrashed()).toEqual([]);
      await expect(repository.purge(trashed.props.id)).rejects.toMatchObject({ name: "NotFoundError" });
    });

    it("saveOrder rewrites sortOrder to the index in the list", async () => {
      const [a, b, c] = [await repository.create(make(0)), await repository.create(make(0)), await repository.create(make(0))];

      await repository.saveOrder([c.props.id, a.props.id, b.props.id]);

      expect(await idsOf()).toEqual([c, a, b].map((item) => item.props.id));
      expect((await repository.list()).map((item) => item.props.sortOrder)).toEqual([0, 1, 2]);
    });

    it("saveOrder is atomic: an unknown id leaves every position unchanged", async () => {
      const [a, b] = [await repository.create(make(0)), await repository.create(make(1))];

      await expect(repository.saveOrder([b.props.id, MISSING_ID, a.props.id])).rejects.toMatchObject({
        name: "NotFoundError",
      });

      expect(await idsOf()).toEqual([a.props.id, b.props.id]);
      expect((await repository.list()).map((item) => item.props.sortOrder)).toEqual([0, 1]);
    });
  });
}
