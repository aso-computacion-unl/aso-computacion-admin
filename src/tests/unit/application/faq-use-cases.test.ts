import { beforeEach, describe, expect, it } from "vitest";

import { CreateFaqUseCase } from "@/application/use-cases/create-faq.use-case";
import { UpdateFaqUseCase } from "@/application/use-cases/update-faq.use-case";
import { NotFoundError } from "@/application/use-cases/use-case-error";
import { CommandNameConflictError, Faq, ValidationError } from "@/domain";
import { InMemoryCommandNameRegistry } from "@/tests/fakes/in-memory-command-name-registry";
import { InMemoryOrderedRepository } from "@/tests/fakes/in-memory-ordered-repository";

const MISSING_ID = "00000000-0000-0000-0000-000000000000";

describe("faq use cases", () => {
  let faqs: InMemoryOrderedRepository<Faq>;
  let commandNames: InMemoryCommandNameRegistry;

  beforeEach(() => {
    faqs = new InMemoryOrderedRepository<Faq>();
    commandNames = new InMemoryCommandNameRegistry(faqs);
  });

  describe("CreateFaqUseCase", () => {
    it("appends an unpublished FAQ after the existing ones", async () => {
      const create = new CreateFaqUseCase(faqs, commandNames);

      const first = await create.execute({ question: "¿Cuesta?", answer: "No." });
      const second = await create.execute({ question: "¿Quién?", answer: "Todos.", isPublished: true });

      expect(first).toMatchObject({ sortOrder: 0, isPublished: false });
      expect(second).toMatchObject({ sortOrder: 1, isPublished: true });
      expect(await faqs.getById(second.id)).not.toBeNull();
    });

    it("rejects invalid text without storing anything", async () => {
      await expect(new CreateFaqUseCase(faqs, commandNames).execute({ question: "", answer: "x" })).rejects.toBeInstanceOf(ValidationError);
      expect(await faqs.list()).toEqual([]);
    });
  });

  describe("UpdateFaqUseCase", () => {
    it("changes the text and the publish flag, keeping the position", async () => {
      const created = await new CreateFaqUseCase(faqs, commandNames).execute({ question: "¿Cuesta?", answer: "No." });

      const updated = await new UpdateFaqUseCase(faqs, commandNames).execute({ id: created.id, answer: "Nunca.", isPublished: true });

      expect(updated).toMatchObject({ id: created.id, question: "¿Cuesta?", answer: "Nunca.", isPublished: true, sortOrder: 0 });
    });

    it("throws NotFoundError for an unknown id and ValidationError for bad text", async () => {
      const created = await new CreateFaqUseCase(faqs, commandNames).execute({ question: "¿Cuesta?", answer: "No." });
      const update = new UpdateFaqUseCase(faqs, commandNames);

      await expect(update.execute({ id: MISSING_ID, answer: "x" })).rejects.toBeInstanceOf(NotFoundError);
      await expect(update.execute({ id: created.id, question: " " })).rejects.toBeInstanceOf(ValidationError);
    });
  });

  describe("command (S1, S3)", () => {
    it("stores the command, and an empty one as null", async () => {
      const create = new CreateFaqUseCase(faqs, commandNames);

      expect(await create.execute({ question: "¿Cuesta?", answer: "No.", command: "costo" })).toMatchObject({ command: "costo" });
      expect(await create.execute({ question: "¿Quién?", answer: "Todos.", command: "" })).toMatchObject({ command: null });
      expect(await create.execute({ question: "¿Dónde?", answer: "Aquí." })).toMatchObject({ command: null });
    });

    it("rejects a command already used by another FAQ and stores nothing", async () => {
      const create = new CreateFaqUseCase(faqs, commandNames);
      await create.execute({ question: "¿Cuesta?", answer: "No.", command: "costo" });

      const attempt = create.execute({ question: "¿Otra?", answer: "x", command: "costo" });

      await expect(attempt).rejects.toBeInstanceOf(CommandNameConflictError);
      await expect(attempt).rejects.toMatchObject({ field: "command", command: "costo", conflict: "faq" });
      expect(await faqs.list()).toHaveLength(1);
    });

    it("rejects a reserved word without storing anything", async () => {
      await expect(new CreateFaqUseCase(faqs, commandNames).execute({ question: "¿Q?", answer: "a", command: "help" })).rejects.toMatchObject({
        conflict: "reserved",
      });
      expect(await faqs.list()).toEqual([]);
    });

    it("update lets a FAQ keep its own command, but not take another FAQ's", async () => {
      const create = new CreateFaqUseCase(faqs, commandNames);
      const first = await create.execute({ question: "¿Cuesta?", answer: "No.", command: "costo" });
      const second = await create.execute({ question: "¿Dónde?", answer: "Aquí.", command: "lugar" });
      const update = new UpdateFaqUseCase(faqs, commandNames);

      expect(await update.execute({ id: first.id, command: "costo", answer: "Gratis." })).toMatchObject({ command: "costo", answer: "Gratis." });
      await expect(update.execute({ id: second.id, command: "costo" })).rejects.toMatchObject({ conflict: "faq" });
      expect((await faqs.getById(second.id))?.props.command).toBe("lugar");
    });

    it("update clears the command with an empty value and frees the name", async () => {
      const create = new CreateFaqUseCase(faqs, commandNames);
      const first = await create.execute({ question: "¿Cuesta?", answer: "No.", command: "costo" });

      expect(await new UpdateFaqUseCase(faqs, commandNames).execute({ id: first.id, command: "" })).toMatchObject({ command: null });
      expect(await create.execute({ question: "¿Otra?", answer: "x", command: "costo" })).toMatchObject({ command: "costo" });
    });
  });
});
