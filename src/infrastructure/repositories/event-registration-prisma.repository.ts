import "server-only";
import type { EventRegistration as PrismaEventRegistration } from "@/generated/prisma/client";

import type {
  EventRegistrationRecord,
  EventRegistrationRepository,
  NewEventRegistration,
  RegisterOutcome,
} from "@/application/ports/event-registration-repository.port";
import { registrationRefusal } from "@/domain/event-registration";

import { prisma } from "../prisma/client";
import { toDomain } from "./event.mapper";

function toRecord(row: PrismaEventRegistration): EventRegistrationRecord {
  return {
    id: row.id,
    eventId: row.eventId,
    mode: row.mode === "unl" ? "unl" : "open",
    name: row.name,
    email: row.email,
    career: row.career,
    semester: row.semester,
    createdAt: row.createdAt,
  };
}

export class EventRegistrationPrismaRepository implements EventRegistrationRepository {
  /**
   * Locks the event row, reads its CURRENT settings and count, and stores the row only if the shared rule
   * accepts it. The lock serializes every registration of one event, so the last seat goes to one person
   * and a repeated email is seen before it is inserted; other events are not slowed down.
   */
  async register(input: NewEventRegistration, now: Date): Promise<RegisterOutcome> {
    return prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "Event" WHERE "id" = ${input.eventId} AND "deletedAt" IS NULL FOR UPDATE
      `;

      if (locked.length === 0) {
        return { status: "not_found" } as const;
      }

      const event = toDomain(await tx.event.findUniqueOrThrow({ where: { id: input.eventId } })).props;
      const [registered, existing] = await Promise.all([
        tx.eventRegistration.count({ where: { eventId: input.eventId } }),
        tx.eventRegistration.findUnique({ where: { eventId_email: { eventId: input.eventId, email: input.email } }, select: { id: true } }),
      ]);
      const refusal = registrationRefusal({ event, mode: input.mode, registered, alreadyRegistered: existing !== null, now });

      if (refusal) {
        return { status: refusal } as const;
      }

      const row = await tx.eventRegistration.create({
        data: {
          id: input.id,
          eventId: input.eventId,
          mode: input.mode,
          name: input.name,
          email: input.email,
          career: input.career,
          semester: input.semester,
          createdAt: now,
        },
      });

      return { status: "registered", registration: toRecord(row) } as const;
    });
  }

  async list(eventId: string): Promise<EventRegistrationRecord[]> {
    const rows = await prisma.eventRegistration.findMany({ where: { eventId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });

    return rows.map(toRecord);
  }

  async count(eventId: string): Promise<number> {
    return prisma.eventRegistration.count({ where: { eventId } });
  }

  async countByEvents(eventIds: readonly string[]): Promise<ReadonlyMap<string, number>> {
    if (eventIds.length === 0) return new Map();

    const groups = await prisma.eventRegistration.groupBy({ by: ["eventId"], where: { eventId: { in: [...eventIds] } }, _count: { _all: true } });

    return new Map(groups.map((group) => [group.eventId, group._count._all]));
  }

  async exists(eventId: string, email: string): Promise<boolean> {
    return (await prisma.eventRegistration.findUnique({ where: { eventId_email: { eventId, email } }, select: { id: true } })) !== null;
  }

  async delete(eventId: string, id: string): Promise<boolean> {
    const { count } = await prisma.eventRegistration.deleteMany({ where: { id, eventId } });

    return count > 0;
  }
}
