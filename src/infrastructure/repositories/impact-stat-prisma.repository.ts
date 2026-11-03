import "server-only";
import type { ImpactStat as PrismaImpactStat } from "@prisma/client";

import type { OrderedContentRepository } from "@/application/ports/ordered-content-repository.port";
import { NotFoundError } from "@/application/use-cases/use-case-error";
import type { ImpactStat } from "@/domain/impact-stat";

import { prisma } from "../prisma/client";
import { toDomain, toPrismaCreate, toPrismaUpdate } from "./impact-stat.mapper";
import { PurgeableTrashPrismaRepository } from "./trashable-prisma.repository";

export class ImpactStatPrismaRepository
  extends PurgeableTrashPrismaRepository<ImpactStat, PrismaImpactStat>
  implements OrderedContentRepository<ImpactStat>
{
  protected readonly delegate = prisma.impactStat;
  protected readonly trashConfig = {
    notFound: "Impact stat not found",
    toDomain,
    toUpdate: toPrismaUpdate,
  };

  async create(stat: ImpactStat): Promise<ImpactStat> {
    return toDomain(await prisma.impactStat.create({ data: toPrismaCreate(stat) }));
  }

  async getById(id: string): Promise<ImpactStat | null> {
    const record = await prisma.impactStat.findUnique({ where: { id, deletedAt: null } });

    return record ? toDomain(record) : null;
  }

  async list(): Promise<ImpactStat[]> {
    // createdAt and id break ties so the list and the move use case agree on the order.
    const records = await prisma.impactStat.findMany({ where: { deletedAt: null }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }] });

    return records.map(toDomain);
  }

  async update(stat: ImpactStat): Promise<ImpactStat> {
    const [record] = await prisma.impactStat.updateManyAndReturn({ where: { id: stat.props.id, deletedAt: null }, data: toPrismaUpdate(stat) });

    if (!record) {
      throw new NotFoundError("Impact stat not found");
    }

    return toDomain(record);
  }

  async saveOrder(orderedIds: readonly string[]): Promise<void> {
    await prisma.$transaction(async (tx) => {
      for (const [sortOrder, id] of orderedIds.entries()) {
        const { count } = await tx.impactStat.updateMany({ where: { id, deletedAt: null }, data: { sortOrder, updatedAt: new Date() } });

        if (count === 0) {
          throw new NotFoundError("Impact stat not found");
        }
      }
    });
  }
}
