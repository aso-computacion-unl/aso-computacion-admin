import "server-only";
import { Prisma } from "@prisma/client";

import type { EventRepository } from "@/application/ports/event-repository.port";
import type { ListCriteria, PublicationCounts } from "@/application/ports/list-criteria";
import { NotFoundError } from "@/application/use-cases/use-case-error";
import { ValidationError } from "@/domain/domain-error";
import type { Event } from "@/domain/event";

import { prisma } from "../prisma/client";
import { toDomain, toPrismaCreate, toPrismaUpdate } from "./event.mapper";
import { publicationWhere, toPublicationCounts } from "./publication-filter";

/** The slug check in the use case is advisory; the unique index is what actually decides a race. */
function rethrowSlugCollision(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    throw new ValidationError("slug", "slug is already used by another event");
  }

  throw error;
}

export class EventPrismaRepository implements EventRepository {
  async create(event: Event): Promise<Event> {
    try {
      return toDomain(await prisma.event.create({ data: toPrismaCreate(event) }));
    } catch (error) {
      return rethrowSlugCollision(error);
    }
  }

  async getById(id: string): Promise<Event | null> {
    const record = await prisma.event.findUnique({ where: { id } });

    return record ? toDomain(record) : null;
  }

  async slugExists(slug: string, excludeId?: string): Promise<boolean> {
    const record = await prisma.event.findFirst({
      where: { slug, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    });

    return record !== null;
  }

  async countByStatus(): Promise<PublicationCounts> {
    // Typed on its own: as an argument, Prisma infers its generic error type from the parameter instead.
    const groups = await prisma.event.groupBy({ by: ["isPublished"], _count: { _all: true } });

    return toPublicationCounts(groups);
  }

  async list(criteria?: ListCriteria): Promise<Event[]> {
    const records = await prisma.event.findMany({
      where: publicationWhere(criteria),
      orderBy: [{ date: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    });

    return records.map(toDomain);
  }

  async update(event: Event): Promise<Event> {
    try {
      const [record] = await prisma.event.updateManyAndReturn({
        where: { id: event.props.id },
        data: toPrismaUpdate(event),
      });

      if (!record) {
        throw new NotFoundError("Event not found");
      }

      return toDomain(record);
    } catch (error) {
      return error instanceof NotFoundError ? Promise.reject(error) : rethrowSlugCollision(error);
    }
  }

  async delete(id: string): Promise<string[]> {
    return prisma.$transaction(async (tx) => {
      // The same lock `EventPhotoPrismaRepository.add` takes: an attach either
      // committed its photo before this point (so it is read below) or waits
      // for this transaction and then finds no event.
      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "Event" WHERE "id" = ${id} FOR UPDATE
      `;

      if (locked.length === 0) {
        throw new NotFoundError("Event not found");
      }

      const photos = await tx.eventPhoto.findMany({ where: { eventId: id }, select: { publicId: true } });

      await tx.event.delete({ where: { id } });

      return photos.map((photo) => photo.publicId);
    });
  }
}
