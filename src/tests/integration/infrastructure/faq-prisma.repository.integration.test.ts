import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { Faq } from "@/domain/faq";
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
});
