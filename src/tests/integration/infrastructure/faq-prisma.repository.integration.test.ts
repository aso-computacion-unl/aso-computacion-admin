import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { CommandNameConflictError } from "@/domain/command-name";
import { Faq } from "@/domain/faq";
import { CommandNamePrismaRegistry } from "@/infrastructure/repositories/command-name-prisma.registry";
import { FaqPrismaRepository } from "@/infrastructure/repositories/faq-prisma.repository";

import { describeOrderedRepositoryContract } from "../support/ordered-repository-contract";

const repository = new FaqPrismaRepository();
const make = (sortOrder: number) =>
  Faq.create({ question: `¿Pregunta ${crypto.randomUUID()}?`, answer: "Respuesta", sortOrder });

describeOrderedRepositoryContract("FaqPrismaRepository", repository, make);

describe("FaqPrismaRepository (integration)", () => {
  it("round-trips accented text and a long answer", async () => {
    const faq = Faq.create({ question: "¿Qué hace la ASO por mí?", answer: "ñ".repeat(1000), sortOrder: 0, isPublished: true });

    await repository.create(faq);

    expect((await repository.getById(faq.props.id))?.props).toEqual(faq.props);
  });

  it("stores the command, lets several FAQs have none, and the unique index rejects a duplicate", async () => {
    const first = Faq.create({ question: "¿Uno?", answer: "a", sortOrder: 0, command: "costo" });

    await repository.create(first);
    await repository.create(Faq.create({ question: "¿Dos?", answer: "b", sortOrder: 1 }));
    await repository.create(Faq.create({ question: "¿Tres?", answer: "c", sortOrder: 2 }));

    expect((await repository.getById(first.props.id))?.props.command).toBe("costo");
    await expect(repository.create(Faq.create({ question: "¿Cuatro?", answer: "d", sortOrder: 3, command: "costo" }))).rejects.toMatchObject({
      field: "command",
      command: "costo",
      conflict: "faq",
    });
    await expect(repository.create(Faq.create({ question: "¿Cinco?", answer: "e", sortOrder: 4, command: "costo" }))).rejects.toBeInstanceOf(
      CommandNameConflictError,
    );

    const other = await repository.create(Faq.create({ question: "¿Seis?", answer: "f", sortOrder: 5, command: "lugar" }));

    await expect(repository.update(other.update({ command: "costo" }))).rejects.toBeInstanceOf(CommandNameConflictError);
  });

  it("the registry finds the owner of a command and ignores the row being edited", async () => {
    const registry = new CommandNamePrismaRegistry();
    const faq = await repository.create(Faq.create({ question: "¿Uno?", answer: "a", sortOrder: 0, command: "costo" }));

    expect(await registry.findOwner("costo")).toBe("faq");
    expect(await registry.findOwner("costo", { kind: "faq", id: faq.props.id })).toBeNull();
    expect(await registry.findOwner("libre")).toBeNull();
  });
});
