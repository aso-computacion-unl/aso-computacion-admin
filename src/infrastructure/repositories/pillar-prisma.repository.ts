import "server-only";

import type { OrderedContentRepository } from "@/application/ports/ordered-content-repository.port";
import type { TrashedItem } from "@/application/ports/trashable-repository.port";
import { NotFoundError } from "@/application/use-cases/use-case-error";
import type { Pillar } from "@/domain/pillar";

import { prisma } from "../prisma/client";
import { toDomain, toPrismaCreate, toPrismaUpdate } from "./pillar.mapper";
import { LIVE } from "./publication-filter";
import { toTrashedItem, TRASH_ORDER, TRASHED } from "./trash";

export class PillarPrismaRepository implements OrderedContentRepository<Pillar> {
  async create(pillar: Pillar): Promise<Pillar> {
    return toDomain(await prisma.pillar.create({ data: toPrismaCreate(pillar) }));
  }

  async getById(id: string): Promise<Pillar | null> {
    const record = await prisma.pillar.findUnique({ where: { id, deletedAt: null } });

    return record ? toDomain(record) : null;
  }

  async list(): Promise<Pillar[]> {
    // createdAt and id break ties so the list and the move use case agree on the order.
    const records = await prisma.pillar.findMany({ where: { deletedAt: null }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }] });

    return records.map(toDomain);
  }

  async update(pillar: Pillar): Promise<Pillar> {
    const [record] = await prisma.pillar.updateManyAndReturn({ where: { id: pillar.props.id, deletedAt: null }, data: toPrismaUpdate(pillar) });

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

  async trash(id: string): Promise<void> {
    const { count } = await prisma.pillar.updateMany({
      where: { id, ...LIVE },
      data: { deletedAt: new Date(), isPublished: false },
    });

    if (count === 0) {
      throw new NotFoundError("Pillar not found");
    }
  }

  async getTrashed(id: string): Promise<TrashedItem<Pillar> | null> {
    const record = await prisma.pillar.findFirst({ where: { id, ...TRASHED } });

    return record ? toTrashedItem(toDomain(record), record.deletedAt) : null;
  }

  async listTrashed(): Promise<TrashedItem<Pillar>[]> {
    const records = await prisma.pillar.findMany({ where: TRASHED, orderBy: [...TRASH_ORDER] });

    return records.map((record) => toTrashedItem(toDomain(record), record.deletedAt));
  }

  async restore(pillar: Pillar): Promise<Pillar> {
    const [record] = await prisma.pillar.updateManyAndReturn({
      where: { id: pillar.props.id, ...TRASHED },
      data: { ...toPrismaUpdate(pillar), deletedAt: null },
    });

    if (!record) {
      throw new NotFoundError("Pillar not found");
    }

    return toDomain(record);
  }

  async purge(id: string): Promise<void> {
    const { count } = await prisma.pillar.deleteMany({ where: { id, ...TRASHED } });

    if (count === 0) {
      throw new NotFoundError("Pillar not found");
    }
  }

  async saveOrder(orderedIds: readonly string[]): Promise<void> {
    await prisma.$transaction(async (tx) => {
      for (const [sortOrder, id] of orderedIds.entries()) {
        const { count } = await tx.pillar.updateMany({ where: { id, deletedAt: null }, data: { sortOrder, updatedAt: new Date() } });

        if (count === 0) {
          throw new NotFoundError("Pillar not found");
        }
      }
    });
  }
}
