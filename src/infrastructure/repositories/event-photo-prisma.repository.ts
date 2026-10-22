import "server-only";

import type { EventPhotoRepository } from "@/application/ports/event-photo-repository.port";
import { NotFoundError } from "@/application/use-cases/use-case-error";
import { ValidationError } from "@/domain/domain-error";
import type { EventPhoto } from "@/domain/event-photo";

import { prisma } from "../prisma/client";
import { toDomain } from "./event-photo.mapper";

export class EventPhotoPrismaRepository implements EventPhotoRepository {
  async getById(id: string): Promise<EventPhoto | null> {
    const record = await prisma.eventPhoto.findUnique({ where: { id } });

    return record ? toDomain(record) : null;
  }

  async listActiveByEventId(eventId: string): Promise<EventPhoto[]> {
    const records = await prisma.eventPhoto.findMany({
      where: { eventId, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });

    return records.map(toDomain);
  }

  async countActiveByEventIds(eventIds: readonly string[]): Promise<ReadonlyMap<string, number>> {
    if (eventIds.length === 0) {
      return new Map();
    }

    const groups = await prisma.eventPhoto.groupBy({
      by: ["eventId"],
      where: { eventId: { in: [...eventIds] }, isActive: true },
      _count: { _all: true },
    });

    return new Map(groups.map((group) => [group.eventId, group._count._all]));
  }

  async listPublicIdsByEventId(eventId: string): Promise<string[]> {
    const records = await prisma.eventPhoto.findMany({ where: { eventId }, select: { publicId: true } });

    return records.map((record) => record.publicId);
  }

  async add(photo: EventPhoto, maxActive: number): Promise<EventPhoto> {
    return prisma.$transaction(async (tx) => {
      // Locking the event row serialises concurrent adds to the same event, so
      // neither the count nor the next position can go stale before the insert.
      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "Event" WHERE "id" = ${photo.props.eventId} FOR UPDATE
      `;

      if (locked.length === 0) {
        throw new NotFoundError("Event not found");
      }

      const where = { eventId: photo.props.eventId, isActive: true };
      const active = await tx.eventPhoto.aggregate({ where, _count: { _all: true }, _max: { sortOrder: true } });

      if (active._count._all >= maxActive) {
        throw new ValidationError("photos", `An event can have at most ${maxActive} active photos`);
      }

      const sortOrder = active._max.sortOrder === null ? 0 : active._max.sortOrder + 1;

      return toDomain(await tx.eventPhoto.create({ data: { ...photo.props, sortOrder } }));
    });
  }

  async update(photo: EventPhoto): Promise<EventPhoto> {
    const { id, alt, sortOrder, isActive } = photo.props;
    const [record] = await prisma.eventPhoto.updateManyAndReturn({
      where: { id },
      data: { alt, sortOrder, isActive },
    });

    if (!record) {
      throw new NotFoundError("Event photo not found");
    }

    return toDomain(record);
  }

  async saveOrder(eventId: string, orderedPhotoIds: readonly string[]): Promise<void> {
    await prisma.$transaction(
      orderedPhotoIds.map((id, index) =>
        prisma.eventPhoto.updateMany({ where: { id, eventId }, data: { sortOrder: index } }),
      ),
    );
  }
}
