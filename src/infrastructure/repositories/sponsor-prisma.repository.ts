import "server-only";
import type { Sponsor as PrismaSponsor } from "@prisma/client";

import type { OrderedContentRepository } from "@/application/ports/ordered-content-repository.port";
import { NotFoundError } from "@/application/use-cases/use-case-error";
import type { Sponsor } from "@/domain/sponsor";

import { prisma } from "../prisma/client";
import { toDomain, toPrismaCreate, toPrismaUpdate } from "./sponsor.mapper";
import { PurgeableTrashPrismaRepository } from "./trashable-prisma.repository";

export class SponsorPrismaRepository
  extends PurgeableTrashPrismaRepository<Sponsor, PrismaSponsor>
  implements OrderedContentRepository<Sponsor>
{
  protected readonly delegate = prisma.sponsor;
  protected readonly trashConfig = {
    notFound: "Sponsor not found",
    toDomain,
    toUpdate: toPrismaUpdate,
  };

  async create(sponsor: Sponsor): Promise<Sponsor> {
    return toDomain(await prisma.sponsor.create({ data: toPrismaCreate(sponsor) }));
  }

  async getById(id: string): Promise<Sponsor | null> {
    const record = await prisma.sponsor.findUnique({ where: { id, deletedAt: null } });

    return record ? toDomain(record) : null;
  }

  async list(): Promise<Sponsor[]> {
    // createdAt and id break ties so the list and the move use case agree on the order.
    const records = await prisma.sponsor.findMany({ where: { deletedAt: null }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }] });

    return records.map(toDomain);
  }

  async update(sponsor: Sponsor): Promise<Sponsor> {
    const [record] = await prisma.sponsor.updateManyAndReturn({ where: { id: sponsor.props.id, deletedAt: null }, data: toPrismaUpdate(sponsor) });

    if (!record) {
      throw new NotFoundError("Sponsor not found");
    }

    return toDomain(record);
  }

  async saveOrder(orderedIds: readonly string[]): Promise<void> {
    await prisma.$transaction(async (tx) => {
      for (const [sortOrder, id] of orderedIds.entries()) {
        const { count } = await tx.sponsor.updateMany({ where: { id, deletedAt: null }, data: { sortOrder, updatedAt: new Date() } });

        if (count === 0) {
          throw new NotFoundError("Sponsor not found");
        }
      }
    });
  }
}
