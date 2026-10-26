import "server-only";
import type { Testimonial as PrismaTestimonial } from "@prisma/client";

import type { OrderedContentRepository } from "@/application/ports/ordered-content-repository.port";
import { NotFoundError } from "@/application/use-cases/use-case-error";
import type { Testimonial } from "@/domain/testimonial";

import { prisma } from "../prisma/client";
import { toDomain, toPrismaCreate, toPrismaUpdate } from "./testimonial.mapper";
import { PurgeableTrashPrismaRepository } from "./trashable-prisma.repository";

export class TestimonialPrismaRepository
  extends PurgeableTrashPrismaRepository<Testimonial, PrismaTestimonial>
  implements OrderedContentRepository<Testimonial>
{
  protected readonly delegate = prisma.testimonial;
  protected readonly trashConfig = {
    notFound: "Testimonial not found",
    toDomain,
    toUpdate: toPrismaUpdate,
  };

  async create(testimonial: Testimonial): Promise<Testimonial> {
    return toDomain(await prisma.testimonial.create({ data: toPrismaCreate(testimonial) }));
  }

  async getById(id: string): Promise<Testimonial | null> {
    const record = await prisma.testimonial.findUnique({ where: { id, deletedAt: null } });

    return record ? toDomain(record) : null;
  }

  async list(): Promise<Testimonial[]> {
    // createdAt and id break ties so the list and the move use case agree on the order.
    const records = await prisma.testimonial.findMany({ where: { deletedAt: null }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }] });

    return records.map(toDomain);
  }

  async update(testimonial: Testimonial): Promise<Testimonial> {
    const [record] = await prisma.testimonial.updateManyAndReturn({ where: { id: testimonial.props.id, deletedAt: null }, data: toPrismaUpdate(testimonial) });

    if (!record) {
      throw new NotFoundError("Testimonial not found");
    }

    return toDomain(record);
  }

  async saveOrder(orderedIds: readonly string[]): Promise<void> {
    await prisma.$transaction(async (tx) => {
      for (const [sortOrder, id] of orderedIds.entries()) {
        const { count } = await tx.testimonial.updateMany({ where: { id, deletedAt: null }, data: { sortOrder, updatedAt: new Date() } });

        if (count === 0) {
          throw new NotFoundError("Testimonial not found");
        }
      }
    });
  }
}
