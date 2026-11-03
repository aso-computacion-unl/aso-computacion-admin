import "server-only";

import type { EventRegistrationRetentionStore, RetentionCandidate } from "@/application/ports/event-registration-retention.port";

import { prisma } from "../prisma/client";

export class EventRegistrationRetentionPrismaStore implements EventRegistrationRetentionStore {
  async candidates(onOrBefore: string): Promise<RetentionCandidate[]> {
    // Trashed events are included on purpose: no `deletedAt` filter.
    const rows = await prisma.event.findMany({
      where: { date: { lte: new Date(`${onOrBefore}T00:00:00.000Z`) }, registrations: { some: {} } },
      select: { id: true, date: true, datePrecision: true },
    });

    return rows.flatMap((row) => (row.date ? [{ id: row.id, date: row.date.toISOString().slice(0, 10), datePrecision: row.datePrecision === "month" ? ("month" as const) : ("day" as const) }] : []));
  }

  /** SKIP LOCKED: a second run at the same moment takes other rows instead of waiting on, or double-counting, these. */
  async deleteBatch(eventIds: string[], limit: number): Promise<number> {
    return prisma.$executeRaw`
      DELETE FROM "EventRegistration" WHERE "id" IN (
        SELECT "id" FROM "EventRegistration" WHERE "eventId" = ANY(${eventIds}) ORDER BY "id" LIMIT ${limit} FOR UPDATE SKIP LOCKED
      )
    `;
  }
}
