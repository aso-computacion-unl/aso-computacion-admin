import "server-only";

import type { OrderedContentRepository } from "@/application/ports/ordered-content-repository.port";
import { NotFoundError } from "@/application/use-cases/use-case-error";
import type { Faq } from "@/domain/faq";

import { prisma } from "../prisma/client";
import { toDomain, toPrismaCreate, toPrismaUpdate } from "./faq.mapper";

export class FaqPrismaRepository implements OrderedContentRepository<Faq> {
  async create(faq: Faq): Promise<Faq> {
    return toDomain(await prisma.faq.create({ data: toPrismaCreate(faq) }));
  }

  async getById(id: string): Promise<Faq | null> {
    const record = await prisma.faq.findUnique({ where: { id } });

    return record ? toDomain(record) : null;
  }

  async list(): Promise<Faq[]> {
    // createdAt and id break ties so the list and the move use case agree on the order.
    const records = await prisma.faq.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }] });

    return records.map(toDomain);
  }

  async update(faq: Faq): Promise<Faq> {
    const [record] = await prisma.faq.updateManyAndReturn({ where: { id: faq.props.id }, data: toPrismaUpdate(faq) });

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
        const { count } = await tx.faq.updateMany({ where: { id }, data: { sortOrder, updatedAt: new Date() } });

        if (count === 0) {
          throw new NotFoundError("Faq not found");
        }
      }
    });
  }
}
