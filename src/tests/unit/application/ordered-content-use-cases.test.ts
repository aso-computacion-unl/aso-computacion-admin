import { beforeEach, describe, expect, it } from "vitest";

import {
  DeleteOrderedContentUseCase,
  GetOrderedContentUseCase,
  ListOrderedContentUseCase,
  MoveOrderedContentUseCase,
  SetOrderedContentPublishedUseCase,
  nextSortOrder,
} from "@/application/use-cases/ordered-content.use-cases";
import { NotFoundError } from "@/application/use-cases/use-case-error";
import { Faq } from "@/domain/faq";
import { InMemoryOrderedRepository } from "@/tests/fakes/in-memory-ordered-repository";

const MISSING_ID = "00000000-0000-0000-0000-000000000000";
const toResult = (faq: Faq) => ({ id: faq.props.id, sortOrder: faq.props.sortOrder, isPublished: faq.props.isPublished });

describe("ordered content use cases", () => {
  let repo: InMemoryOrderedRepository<Faq>;
  let ids: string[];

  async function seed(count: number): Promise<void> {
    ids = [];
    for (let sortOrder = 0; sortOrder < count; sortOrder += 1) {
      const faq = await repo.create(Faq.create({ question: `Q${sortOrder}`, answer: "A", sortOrder }));
      ids.push(faq.props.id);
    }
  }

  const order = async () => (await repo.list()).map((faq) => faq.props.id);

  beforeEach(() => {
    repo = new InMemoryOrderedRepository<Faq>();
  });

  describe("nextSortOrder", () => {
    it("is 0 for an empty list and one past the highest position otherwise", async () => {
      expect(nextSortOrder([])).toBe(0);
      await seed(3);
      expect(nextSortOrder(await repo.list())).toBe(3);
    });
  });

  describe("ListOrderedContentUseCase", () => {
    it("returns every item in display order, drafts included", async () => {
      await seed(2);

      const result = await new ListOrderedContentUseCase(repo, toResult).execute();

      expect(result.map((item) => item.id)).toEqual(ids);
      expect(result.every((item) => item.isPublished === false)).toBe(true);
    });
  });

  describe("GetOrderedContentUseCase", () => {
    it("returns one item and throws NotFoundError for an unknown id", async () => {
      await seed(1);
      const get = new GetOrderedContentUseCase(repo, toResult, "Faq not found");

      expect((await get.execute({ id: ids[0]! })).id).toBe(ids[0]);
      await expect(get.execute({ id: MISSING_ID })).rejects.toThrow(new NotFoundError("Faq not found"));
    });
  });

  describe("SetOrderedContentPublishedUseCase", () => {
    it("publishes and unpublishes", async () => {
      await seed(1);
      const setPublished = new SetOrderedContentPublishedUseCase(repo, toResult, "Faq not found");

      expect((await setPublished.execute({ id: ids[0]!, isPublished: true })).isPublished).toBe(true);
      expect((await setPublished.execute({ id: ids[0]!, isPublished: false })).isPublished).toBe(false);
    });

    it("throws NotFoundError for an unknown id", async () => {
      await expect(
        new SetOrderedContentPublishedUseCase(repo, toResult, "Faq not found").execute({ id: MISSING_ID, isPublished: true }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe("DeleteOrderedContentUseCase", () => {
    it("removes the item and throws NotFoundError when it is gone", async () => {
      await seed(2);
      const remove = new DeleteOrderedContentUseCase(repo, "Faq not found");

      await remove.execute({ id: ids[0]! });

      expect(await order()).toEqual([ids[1]]);
      await expect(remove.execute({ id: ids[0]! })).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe("MoveOrderedContentUseCase", () => {
    it("swaps with the neighbour and renumbers 0..n-1", async () => {
      await seed(3);
      const move = new MoveOrderedContentUseCase(repo, "Faq not found");

      await move.execute({ id: ids[2]!, direction: "up" });
      expect(await order()).toEqual([ids[0], ids[2], ids[1]]);

      await move.execute({ id: ids[0]!, direction: "down" });
      expect(await order()).toEqual([ids[2], ids[0], ids[1]]);
      expect((await repo.list()).map((faq) => faq.props.sortOrder)).toEqual([0, 1, 2]);
    });

    it("is a no-op past either end", async () => {
      await seed(2);
      const move = new MoveOrderedContentUseCase(repo, "Faq not found");

      await move.execute({ id: ids[0]!, direction: "up" });
      await move.execute({ id: ids[1]!, direction: "down" });

      expect(await order()).toEqual(ids);
    });

    it("moves items that share a sortOrder (a gap left by a delete is renumbered too)", async () => {
      await seed(3);
      await repo.delete(ids[1]!);

      await new MoveOrderedContentUseCase(repo, "Faq not found").execute({ id: ids[2]!, direction: "up" });

      expect(await order()).toEqual([ids[2], ids[0]]);
      expect((await repo.list()).map((faq) => faq.props.sortOrder)).toEqual([0, 1]);
    });

    it("throws NotFoundError for an unknown id", async () => {
      await expect(
        new MoveOrderedContentUseCase(repo, "Faq not found").execute({ id: MISSING_ID, direction: "up" }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});
