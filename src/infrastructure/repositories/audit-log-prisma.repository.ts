import "server-only";

import { Prisma } from "@/generated/prisma/client";

import type {
  AuditActivityCriteria,
  AuditActivityReader,
  AuditDayCount,
  AuditEntry,
  AuditEntryInput,
  AuditListCriteria,
  AuditLogReader,
  AuditRecorder,
} from "@/application/ports/auth.ports";

import { prisma } from "../prisma/client";

function actorFilter(actor: string | undefined): Prisma.AuditLogWhereInput {
  if (!actor) {
    return {};
  }

  return actor === "break_glass" || actor === "system" ? { actorKind: actor, actorUserId: null } : { actorUserId: actor };
}

export class AuditLogPrismaRepository implements AuditRecorder, AuditLogReader, AuditActivityReader {
  /** `at` is only passed by tests that need a known order. */
  async record(entry: AuditEntryInput, at: Date = new Date()): Promise<void> {
    await prisma.auditLog.create({
      data: {
        id: crypto.randomUUID(),
        at,
        actorUserId: entry.actorUserId,
        actorKind: entry.actorKind,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        summary: entry.summary,
      },
    });
  }

  async list({ entityType, actor, page, pageSize }: AuditListCriteria): Promise<{ items: AuditEntry[]; total: number }> {
    const where: Prisma.AuditLogWhereInput = { ...(entityType ? { entityType } : {}), ...actorFilter(actor) };
    const [rows, total] = await Promise.all([
      prisma.auditLog.findMany({ where, orderBy: [{ at: "desc" }, { id: "desc" }], skip: (page - 1) * pageSize, take: pageSize }),
      prisma.auditLog.count({ where }),
    ]);

    return { items: rows, total };
  }

  async entityTypes(): Promise<string[]> {
    const rows = await prisma.auditLog.findMany({ distinct: ["entityType"], select: { entityType: true }, orderBy: { entityType: "asc" } });

    return rows.map((row) => row.entityType);
  }

  /**
   * One grouped query. `at` is stored as UTC wall time (timestamp without zone), so it is read as UTC
   * and then put on Ecuador's calendar. The bounds go in as ISO text with their zone, so the session's
   * TimeZone never changes the result.
   */
  async countByDay({ from, to, actorUserId }: AuditActivityCriteria): Promise<AuditDayCount[]> {
    const byActor = actorUserId ? Prisma.sql`AND "actorUserId" = ${actorUserId}` : Prisma.empty;

    return prisma.$queryRaw<AuditDayCount[]>`
      SELECT to_char(("at" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Guayaquil', 'YYYY-MM-DD') AS "date", count(*)::int AS "count"
      FROM "AuditLog"
      WHERE "at" >= (${from.toISOString()}::timestamptz AT TIME ZONE 'UTC')
        AND "at" < (${to.toISOString()}::timestamptz AT TIME ZONE 'UTC')
        ${byActor}
      GROUP BY 1
      ORDER BY 1`;
  }
}
