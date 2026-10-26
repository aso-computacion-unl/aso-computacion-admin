import "server-only";

import type { OrderedContentRepository } from "@/application/ports/ordered-content-repository.port";
import type { TrashedItem } from "@/application/ports/trashable-repository.port";
import { NotFoundError } from "@/application/use-cases/use-case-error";
import type { SocialLink } from "@/domain/social-link";

import { prisma } from "../prisma/client";
import { toDomain, toPrismaCreate, toPrismaUpdate } from "./social-link.mapper";
import { LIVE } from "./publication-filter";
import { toTrashedItem, TRASH_ORDER, TRASHED } from "./trash";

export class SocialLinkPrismaRepository implements OrderedContentRepository<SocialLink> {
  async create(link: SocialLink): Promise<SocialLink> {
    return toDomain(await prisma.socialLink.create({ data: toPrismaCreate(link) }));
  }

  async getById(id: string): Promise<SocialLink | null> {
    const record = await prisma.socialLink.findUnique({ where: { id, deletedAt: null } });

    return record ? toDomain(record) : null;
  }

  async list(): Promise<SocialLink[]> {
    // createdAt and id break ties so the list and the move use case agree on the order.
    const records = await prisma.socialLink.findMany({ where: { deletedAt: null }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }] });

    return records.map(toDomain);
  }

  async update(link: SocialLink): Promise<SocialLink> {
    const [record] = await prisma.socialLink.updateManyAndReturn({ where: { id: link.props.id, deletedAt: null }, data: toPrismaUpdate(link) });

    if (!record) {
      throw new NotFoundError("Social link not found");
    }

    return toDomain(record);
  }

  async delete(id: string): Promise<void> {
    const { count } = await prisma.socialLink.deleteMany({ where: { id } });

    if (count === 0) {
      throw new NotFoundError("Social link not found");
    }
  }

  async trash(id: string): Promise<void> {
    const { count } = await prisma.socialLink.updateMany({
      where: { id, ...LIVE },
      data: { deletedAt: new Date(), isPublished: false },
    });

    if (count === 0) {
      throw new NotFoundError("Social link not found");
    }
  }

  async getTrashed(id: string): Promise<TrashedItem<SocialLink> | null> {
    const record = await prisma.socialLink.findFirst({ where: { id, ...TRASHED } });

    return record ? toTrashedItem(toDomain(record), record.deletedAt) : null;
  }

  async listTrashed(): Promise<TrashedItem<SocialLink>[]> {
    const records = await prisma.socialLink.findMany({ where: TRASHED, orderBy: [...TRASH_ORDER] });

    return records.map((record) => toTrashedItem(toDomain(record), record.deletedAt));
  }

  async restore(link: SocialLink): Promise<SocialLink> {
    const [record] = await prisma.socialLink.updateManyAndReturn({
      where: { id: link.props.id, ...TRASHED },
      data: { ...toPrismaUpdate(link), deletedAt: null },
    });

    if (!record) {
      throw new NotFoundError("Social link not found");
    }

    return toDomain(record);
  }

  async purge(id: string): Promise<void> {
    const { count } = await prisma.socialLink.deleteMany({ where: { id, ...TRASHED } });

    if (count === 0) {
      throw new NotFoundError("Social link not found");
    }
  }

  async saveOrder(orderedIds: readonly string[]): Promise<void> {
    await prisma.$transaction(async (tx) => {
      for (const [sortOrder, id] of orderedIds.entries()) {
        const { count } = await tx.socialLink.updateMany({ where: { id, deletedAt: null }, data: { sortOrder, updatedAt: new Date() } });

        if (count === 0) {
          throw new NotFoundError("Social link not found");
        }
      }
    });
  }
}
