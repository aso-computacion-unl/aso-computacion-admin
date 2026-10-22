import "server-only";

import type { OrderedContentRepository } from "@/application/ports/ordered-content-repository.port";
import { NotFoundError } from "@/application/use-cases/use-case-error";
import type { Pillar } from "@/domain/pillar";

import { prisma } from "../prisma/client";
import { toDomain, toPrismaCreate, toPrismaUpdate } from "./pillar.mapper";

export class PillarPrismaRepository implements OrderedContentRepository<Pillar> {
  async create(pillar: Pillar): Promise<Pillar> {
    return toDomain(await prisma.pillar.create({ data: toPrismaCreate(pillar) }));
  }

  async getById(id: string): Promise<Pillar | null> {
    const record = await prisma.pillar.findUnique({ where: { id } });

    return record ? toDomain(record) : null;
  }

  async list(): Promise<Pillar[]> {
    // createdAt and id break ties so the list and the move use case agree on the order.
    const records = await prisma.pillar.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }] });

    return records.map(toDomain);
  }

  async update(pillar: Pillar): Promise<Pillar> {
    const [record] = await prisma.pillar.updateManyAndReturn({ where: { id: pillar.props.id }, data: toPrismaUpdate(pillar) });

    if (!record) {
      throw new NotFoundError("Pillar not found");
    }

    return toDomain(record);
  }

  async delete(id: string): Promise<void> {
    const { count } = await prisma.pillar.deleteMany({ where: { id } });

    if (count === 0) {
      throw new NotFoundError("Pillar not found");
    }
  }

  async saveOrder(orderedIds: readonly string[]): Promise<void> {
    await prisma.$transaction(async (tx) => {
      for (const [sortOrder, id] of orderedIds.entries()) {
        const { count } = await tx.pillar.updateMany({ where: { id }, data: { sortOrder, updatedAt: new Date() } });

        if (count === 0) {
          throw new NotFoundError("Pillar not found");
        }
      }
    });
  }
}
