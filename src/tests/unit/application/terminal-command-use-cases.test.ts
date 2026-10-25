import { beforeEach, describe, expect, it } from "vitest";

import { CreateFaqUseCase } from "@/application/use-cases/create-faq.use-case";
import { CreateTerminalCommandUseCase } from "@/application/use-cases/create-terminal-command.use-case";
import { UpdateFaqUseCase } from "@/application/use-cases/update-faq.use-case";
import { UpdateTerminalCommandUseCase } from "@/application/use-cases/update-terminal-command.use-case";
import { NotFoundError } from "@/application/use-cases/use-case-error";
import { CommandNameConflictError, Faq, ValidationError } from "@/domain";
import type { TerminalCommand } from "@/domain/terminal-command";
import { InMemoryCommandNameRegistry } from "@/tests/fakes/in-memory-command-name-registry";
import { InMemoryOrderedRepository } from "@/tests/fakes/in-memory-ordered-repository";

const MISSING_ID = "00000000-0000-0000-0000-000000000000";
const input = { command: "horario", description: "Cuándo nos reunimos", output: "Martes y jueves." };

describe("terminal command use cases", () => {
  let faqs: InMemoryOrderedRepository<Faq>;
  let commands: InMemoryOrderedRepository<TerminalCommand>;
  let commandNames: InMemoryCommandNameRegistry;

  beforeEach(() => {
    faqs = new InMemoryOrderedRepository<Faq>();
    commands = new InMemoryOrderedRepository<TerminalCommand>();
    commandNames = new InMemoryCommandNameRegistry(faqs, commands);
  });

  describe("CreateTerminalCommandUseCase", () => {
    it("appends an unpublished command after the existing ones", async () => {
      const create = new CreateTerminalCommandUseCase(commands, commandNames);

      const first = await create.execute(input);
      const second = await create.execute({ ...input, command: "whoami", isPublished: true });

      expect(first).toMatchObject({ command: "horario", sortOrder: 0, isPublished: false });
      expect(second).toMatchObject({ command: "whoami", sortOrder: 1, isPublished: true });
      expect(await commands.getById(second.id)).not.toBeNull();
    });

    it("rejects an invalid field without storing anything", async () => {
      const create = new CreateTerminalCommandUseCase(commands, commandNames);

      await expect(create.execute({ ...input, command: "Mal Nombre" })).rejects.toBeInstanceOf(ValidationError);
      await expect(create.execute({ ...input, output: "" })).rejects.toBeInstanceOf(ValidationError);
      expect(await commands.list()).toEqual([]);
    });

    it("rejects a reserved word, naming it, without storing anything", async () => {
      await expect(new CreateTerminalCommandUseCase(commands, commandNames).execute({ ...input, command: "clear" })).rejects.toMatchObject({
        field: "command",
        command: "clear",
        conflict: "reserved",
      });
      expect(await commands.list()).toEqual([]);
    });

    it("rejects a name already used by another free command (published or not)", async () => {
      const create = new CreateTerminalCommandUseCase(commands, commandNames);
      await create.execute(input);

      await expect(create.execute({ ...input, description: "Otro" })).rejects.toMatchObject({ conflict: "command", command: "horario" });
      expect(await commands.list()).toHaveLength(1);
    });

    it("rejects a name already used as a FAQ command", async () => {
      await new CreateFaqUseCase(faqs, commandNames).execute({ question: "¿Cuándo?", answer: "Martes.", command: "horario" });

      const attempt = new CreateTerminalCommandUseCase(commands, commandNames).execute(input);

      await expect(attempt).rejects.toBeInstanceOf(CommandNameConflictError);
      await expect(attempt).rejects.toMatchObject({ conflict: "faq", command: "horario" });
      expect(await commands.list()).toEqual([]);
    });
  });

  describe("FAQ commands against free commands", () => {
    it("a FAQ cannot take a free command's name, on create or on update", async () => {
      await new CreateTerminalCommandUseCase(commands, commandNames).execute(input);
      const createFaq = new CreateFaqUseCase(faqs, commandNames);

      await expect(createFaq.execute({ question: "¿Cuándo?", answer: "Martes.", command: "horario" })).rejects.toMatchObject({
        conflict: "command",
        command: "horario",
      });
      expect(await faqs.list()).toEqual([]);

      const faq = await createFaq.execute({ question: "¿Dónde?", answer: "Aquí." });

      await expect(new UpdateFaqUseCase(faqs, commandNames).execute({ id: faq.id, command: "horario" })).rejects.toMatchObject({
        conflict: "command",
      });
    });
  });

  describe("UpdateTerminalCommandUseCase", () => {
    it("changes the fields and the publish flag, keeping the position", async () => {
      const created = await new CreateTerminalCommandUseCase(commands, commandNames).execute(input);

      const updated = await new UpdateTerminalCommandUseCase(commands, commandNames).execute({
        id: created.id,
        output: "Lunes.",
        isPublished: true,
      });

      expect(updated).toMatchObject({ id: created.id, command: "horario", output: "Lunes.", isPublished: true, sortOrder: 0 });
    });

    it("lets a command keep its own name but not take another command's or a FAQ's", async () => {
      const create = new CreateTerminalCommandUseCase(commands, commandNames);
      const first = await create.execute(input);
      await create.execute({ ...input, command: "whoami" });
      await new CreateFaqUseCase(faqs, commandNames).execute({ question: "¿Costo?", answer: "No.", command: "costo" });
      const update = new UpdateTerminalCommandUseCase(commands, commandNames);

      expect(await update.execute({ id: first.id, command: "horario", description: "Nueva" })).toMatchObject({ description: "Nueva" });
      await expect(update.execute({ id: first.id, command: "whoami" })).rejects.toMatchObject({ conflict: "command" });
      await expect(update.execute({ id: first.id, command: "costo" })).rejects.toMatchObject({ conflict: "faq" });
      await expect(update.execute({ id: first.id, command: "help" })).rejects.toMatchObject({ conflict: "reserved" });
      expect((await commands.getById(first.id))?.props.command).toBe("horario");
    });

    it("throws NotFoundError for an unknown id and ValidationError for bad text", async () => {
      const created = await new CreateTerminalCommandUseCase(commands, commandNames).execute(input);
      const update = new UpdateTerminalCommandUseCase(commands, commandNames);

      await expect(update.execute({ id: MISSING_ID, output: "x" })).rejects.toBeInstanceOf(NotFoundError);
      await expect(update.execute({ id: created.id, description: " " })).rejects.toBeInstanceOf(ValidationError);
    });
  });
});
