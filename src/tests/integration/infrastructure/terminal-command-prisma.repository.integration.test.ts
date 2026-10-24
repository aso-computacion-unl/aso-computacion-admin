import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { CommandNameConflictError } from "@/domain/command-name";
import { Faq } from "@/domain/faq";
import { TerminalCommand } from "@/domain/terminal-command";
import { CommandNamePrismaRegistry } from "@/infrastructure/repositories/command-name-prisma.registry";
import { FaqPrismaRepository } from "@/infrastructure/repositories/faq-prisma.repository";
import { TerminalCommandPrismaRepository } from "@/infrastructure/repositories/terminal-command-prisma.repository";

import { describeOrderedRepositoryContract } from "../support/ordered-repository-contract";

const repository = new TerminalCommandPrismaRepository();
const make = (sortOrder: number, command = `cmd-${crypto.randomUUID().slice(0, 8)}`) =>
  TerminalCommand.create({ command, description: "Descripción", output: "Salida", sortOrder });

describeOrderedRepositoryContract("TerminalCommandPrismaRepository", repository, make);

describe("TerminalCommandPrismaRepository (integration)", () => {
  it("round-trips accented text and a multi-line output", async () => {
    const command = TerminalCommand.create({
      command: "inscripciones",
      description: "Cómo me inscribo",
      output: `${"ñ".repeat(100)}\nSegunda línea\n\nTercera`,
      sortOrder: 0,
      isPublished: true,
    });

    await repository.create(command);

    expect((await repository.getById(command.props.id))?.props).toEqual(command.props);
  });

  it("the unique index rejects a duplicate name on create and on update", async () => {
    await repository.create(make(0, "horario"));
    const other = await repository.create(make(1, "whoami"));

    await expect(repository.create(make(2, "horario"))).rejects.toMatchObject({ field: "command", command: "horario", conflict: "command" });
    await expect(repository.update(other.update({ command: "horario" }))).rejects.toBeInstanceOf(CommandNameConflictError);
    expect((await repository.getById(other.props.id))?.props.command).toBe("whoami");
  });

  it("the registry finds the owner across both tables and ignores the row being edited", async () => {
    const registry = new CommandNamePrismaRegistry();
    const faq = await new FaqPrismaRepository().create(Faq.create({ question: "¿Costo?", answer: "No.", sortOrder: 0, command: "costo" }));
    const free = await repository.create(make(0, "horario"));

    expect(await registry.findOwner("costo")).toBe("faq");
    expect(await registry.findOwner("horario")).toBe("command");
    expect(await registry.findOwner("libre")).toBeNull();
    expect(await registry.findOwner("costo", { kind: "faq", id: faq.props.id })).toBeNull();
    expect(await registry.findOwner("horario", { kind: "command", id: free.props.id })).toBeNull();
    // The exception is per table: a free command with the same id string never hides a FAQ.
    expect(await registry.findOwner("costo", { kind: "command", id: faq.props.id })).toBe("faq");
  });
});
