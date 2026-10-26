import "server-only";

import type { Prisma } from "@prisma/client";

import type { AuditEntry, AuditEntryInput, AuditListCriteria, AuditLogReader, AuditRecorder } from "@/application/ports/auth.ports";

import { prisma } from "../prisma/client";

function actorFilter(actor: string | undefined): Prisma.AuditLogWhereInput {
  if (!actor) {
    return {};
  }

  return actor === "break_glass" || actor === "system" ? { actorKind: actor, actorUserId: null } : { actorUserId: actor };
}

export class AuditLogPrismaRepository implements AuditRecorder, AuditLogReader {
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
}
