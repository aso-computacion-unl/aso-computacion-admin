import { beforeEach, describe, expect, it } from "vitest";

import { CreateFaqUseCase } from "@/application/use-cases/create-faq.use-case";
import { UpdateFaqUseCase } from "@/application/use-cases/update-faq.use-case";
import { NotFoundError } from "@/application/use-cases/use-case-error";
import { Faq, ValidationError } from "@/domain";
import { InMemoryOrderedRepository } from "@/tests/fakes/in-memory-ordered-repository";

const MISSING_ID = "00000000-0000-0000-0000-000000000000";

describe("faq use cases", () => {
  let faqs: InMemoryOrderedRepository<Faq>;

  beforeEach(() => {
    faqs = new InMemoryOrderedRepository<Faq>();
  });

  describe("CreateFaqUseCase", () => {
    it("appends an unpublished FAQ after the existing ones", async () => {
      const create = new CreateFaqUseCase(faqs);

      const first = await create.execute({ question: "¿Cuesta?", answer: "No." });
      const second = await create.execute({ question: "¿Quién?", answer: "Todos.", isPublished: true });

      expect(first).toMatchObject({ sortOrder: 0, isPublished: false });
      expect(second).toMatchObject({ sortOrder: 1, isPublished: true });
      expect(await faqs.getById(second.id)).not.toBeNull();
    });

    it("rejects invalid text without storing anything", async () => {
      await expect(new CreateFaqUseCase(faqs).execute({ question: "", answer: "x" })).rejects.toBeInstanceOf(ValidationError);
      expect(await faqs.list()).toEqual([]);
    });
  });

  describe("UpdateFaqUseCase", () => {
    it("changes the text and the publish flag, keeping the position", async () => {
      const created = await new CreateFaqUseCase(faqs).execute({ question: "¿Cuesta?", answer: "No." });

      const updated = await new UpdateFaqUseCase(faqs).execute({ id: created.id, answer: "Nunca.", isPublished: true });

      expect(updated).toMatchObject({ id: created.id, question: "¿Cuesta?", answer: "Nunca.", isPublished: true, sortOrder: 0 });
    });

    it("throws NotFoundError for an unknown id and ValidationError for bad text", async () => {
      const created = await new CreateFaqUseCase(faqs).execute({ question: "¿Cuesta?", answer: "No." });
      const update = new UpdateFaqUseCase(faqs);

      await expect(update.execute({ id: MISSING_ID, answer: "x" })).rejects.toBeInstanceOf(NotFoundError);
      await expect(update.execute({ id: created.id, question: " " })).rejects.toBeInstanceOf(ValidationError);
    });
  });
});
