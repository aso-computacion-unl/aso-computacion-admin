import "server-only";
import { Prisma } from "@prisma/client";

import type { OrderedContentRepository } from "@/application/ports/ordered-content-repository.port";
import { NotFoundError } from "@/application/use-cases/use-case-error";
import { CommandNameConflictError } from "@/domain/command-name";
import type { Faq } from "@/domain/faq";

import { prisma } from "../prisma/client";
import { toDomain, toPrismaCreate, toPrismaUpdate } from "./faq.mapper";

/** The command check in the use case is advisory; the unique index is what actually decides a race. */
function rethrowCommandCollision(error: unknown, faq: Faq): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" && faq.props.command) {
    throw new CommandNameConflictError("command", faq.props.command, "faq");
  }

  throw error;
}

export class FaqPrismaRepository implements OrderedContentRepository<Faq> {
  async create(faq: Faq): Promise<Faq> {
    try {
      return toDomain(await prisma.faq.create({ data: toPrismaCreate(faq) }));
    } catch (error) {
      return rethrowCommandCollision(error, faq);
    }
  }

  async getById(id: string): Promise<Faq | null> {
    const record = await prisma.faq.findUnique({ where: { id, deletedAt: null } });

    return record ? toDomain(record) : null;
  }

  async list(): Promise<Faq[]> {
    // createdAt and id break ties so the list and the move use case agree on the order.
    const records = await prisma.faq.findMany({ where: { deletedAt: null }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }] });

    return records.map(toDomain);
  }

  async update(faq: Faq): Promise<Faq> {
    let record;

    try {
      [record] = await prisma.faq.updateManyAndReturn({ where: { id: faq.props.id, deletedAt: null }, data: toPrismaUpdate(faq) });
    } catch (error) {
      return rethrowCommandCollision(error, faq);
    }

    if (!record) {
      throw new NotFoundError("Faq not found");
    }

    return toDomain(record);
  }

  async delete(id: string): Promise<void> {
    const { count } = await prisma.faq.deleteMany({ where: { id } });

    if (count === 0) {
      throw new NotFoundError("Faq not found");
    }
  }

  async saveOrder(orderedIds: readonly string[]): Promise<void> {
    await prisma.$transaction(async (tx) => {
      for (const [sortOrder, id] of orderedIds.entries()) {
        const { count } = await tx.faq.updateMany({ where: { id, deletedAt: null }, data: { sortOrder, updatedAt: new Date() } });

        if (count === 0) {
          throw new NotFoundError("Faq not found");
        }
      }
    });
  }
}
