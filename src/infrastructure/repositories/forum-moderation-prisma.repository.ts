import "server-only";

import { Prisma, type ForumMember as MemberRow } from "@/generated/prisma/client";

import type {
  ForumModerationChange,
  ForumModerationRepository,
  ForumModerationStamp,
  ForumPostTarget,
  ForumReportQueue,
  ForumReportRow,
} from "@/application/ports/forum-moderation.ports";
import type { ForumReport } from "@/domain/forum";

import { prisma } from "../prisma/client";

const AUTHOR = { select: { id: true, displayName: true, status: true } } as const;

/** Only names, ids and the post's own text are read: no email and no Google id ever leave the table. */
const REPORT_INCLUDE = {
  reporter: { select: { displayName: true } },
  thread: { select: { id: true, title: true, body: true, hiddenAt: true, lockedAt: true, author: AUTHOR } },
  reply: { select: { body: true, hiddenAt: true, author: AUTHOR, thread: { select: { id: true, title: true, lockedAt: true } } } },
} satisfies Prisma.ForumReportInclude;

type ReportRecord = Prisma.ForumReportGetPayload<{ include: typeof REPORT_INCLUDE }>;

const suspended = (author: Pick<MemberRow, "status">) => author.status === "SUSPENDED";

function toReport(row: ReportRecord): ForumReport {
  return {
    id: row.id,
    reporterId: row.reporterId,
    threadId: row.threadId,
    replyId: row.replyId,
    reason: row.reason,
    status: row.status,
    createdAt: row.createdAt,
    resolvedAt: row.resolvedAt,
    resolvedBy: row.resolvedBy,
    resolutionNote: row.resolutionNote,
  };
}

function toRow(row: ReportRecord): ForumReportRow | null {
  const base = { report: toReport(row), reporterName: row.reporter.displayName };

  if (row.reply) {
    const { reply } = row;

    return {
      ...base,
      post: {
        kind: "reply",
        threadId: reply.thread.id,
        threadTitle: reply.thread.title,
        body: reply.body,
        authorId: reply.author.id,
        authorName: reply.author.displayName,
        authorSuspended: suspended(reply.author),
        hidden: reply.hiddenAt !== null,
        locked: reply.thread.lockedAt !== null,
      },
    };
  }

  if (row.thread) {
    const { thread } = row;

    return {
      ...base,
      post: {
        kind: "thread",
        threadId: thread.id,
        threadTitle: thread.title,
        body: thread.body,
        authorId: thread.author.id,
        authorName: thread.author.displayName,
        authorSuspended: suspended(thread.author),
        hidden: thread.hiddenAt !== null,
        locked: thread.lockedAt !== null,
      },
    };
  }

  return null;
}

/** The statement matched nothing: the row is either already in the wanted state or not there at all. */
const unchangedOrMissing = (exists: boolean): ForumModerationChange => (exists ? "unchanged" : "not-found");

export class ForumModerationPrismaRepository implements ForumModerationRepository {
  async createReport(report: ForumReport): Promise<boolean> {
    try {
      await prisma.forumReport.create({ data: report });
      return true;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return false;
      }

      throw error;
    }
  }

  async listReports(queue: ForumReportQueue, page: { offset: number; limit: number }): Promise<{ items: ForumReportRow[]; total: number }> {
    const open = queue === "open";
    const where: Prisma.ForumReportWhereInput = { status: open ? "OPEN" : { not: "OPEN" } };
    const orderBy: Prisma.ForumReportOrderByWithRelationInput[] = open ? [{ createdAt: "asc" }, { id: "asc" }] : [{ resolvedAt: "desc" }, { id: "desc" }];
    const [rows, total] = await prisma.$transaction([
      prisma.forumReport.findMany({ where, orderBy, skip: page.offset, take: page.limit, include: REPORT_INCLUDE }),
      prisma.forumReport.count({ where }),
    ]);

    return { items: rows.flatMap((row) => toRow(row) ?? []), total };
  }

  async closeReport(id: string, change: ForumModerationStamp & { status: "RESOLVED" | "DISMISSED"; note: string | null }): Promise<"ok" | "not-found" | "closed"> {
    // One conditional statement: of two moderators closing at once, only one matches the OPEN row.
    const { count } = await prisma.forumReport.updateMany({
      where: { id, status: "OPEN" },
      data: { status: change.status, resolvedAt: change.at, resolvedBy: change.by, resolutionNote: change.note },
    });

    if (count > 0) {
      return "ok";
    }

    return (await prisma.forumReport.count({ where: { id } })) > 0 ? "closed" : "not-found";
  }

  async setPostHidden(target: ForumPostTarget, hidden: boolean, stamp: ForumModerationStamp): Promise<ForumModerationChange> {
    const data = hidden ? { hiddenAt: stamp.at, hiddenBy: stamp.by } : { hiddenAt: null, hiddenBy: null };

    if (target.kind === "thread") {
      const { count } = await prisma.forumThread.updateMany({ where: { id: target.id, hiddenAt: hidden ? null : { not: null } }, data });

      return count > 0 ? "changed" : unchangedOrMissing((await prisma.forumThread.count({ where: { id: target.id } })) > 0);
    }

    return prisma.$transaction(async (tx) => {
      const { count } = await tx.forumReply.updateMany({ where: { id: target.id, hiddenAt: hidden ? null : { not: null } }, data });

      if (hidden) {
        // A hidden reply cannot stay the thread's best answer. Same lock order as marking one: reply, then thread.
        await tx.forumThread.updateMany({ where: { bestReplyId: target.id }, data: { bestReplyId: null } });
      }

      return count > 0 ? "changed" : unchangedOrMissing((await tx.forumReply.count({ where: { id: target.id } })) > 0);
    });
  }

  async setThreadLocked(threadId: string, locked: boolean, stamp: ForumModerationStamp): Promise<ForumModerationChange> {
    const data = locked ? { lockedAt: stamp.at, lockedBy: stamp.by } : { lockedAt: null, lockedBy: null };
    const { count } = await prisma.forumThread.updateMany({ where: { id: threadId, lockedAt: locked ? null : { not: null } }, data });

    return count > 0 ? "changed" : unchangedOrMissing((await prisma.forumThread.count({ where: { id: threadId } })) > 0);
  }

  async setMemberSuspended(memberId: string, suspend: boolean, stamp: ForumModerationStamp): Promise<ForumModerationChange> {
    return prisma.$transaction(async (tx) => {
      const { count } = suspend
        ? await tx.forumMember.updateMany({ where: { id: memberId, status: "ACTIVE" }, data: { status: "SUSPENDED", suspendedAt: stamp.at, suspendedBy: stamp.by } })
        : await tx.forumMember.updateMany({ where: { id: memberId, status: "SUSPENDED" }, data: { status: "ACTIVE", suspendedAt: null, suspendedBy: null } });

      if (suspend) {
        // Also when the member was already suspended: whatever session survived is closed now. Reactivating does not bring any back.
        await tx.forumSession.updateMany({ where: { memberId, revokedAt: null }, data: { revokedAt: stamp.at } });
      }

      return count > 0 ? "changed" : unchangedOrMissing((await tx.forumMember.count({ where: { id: memberId } })) > 0);
    });
  }
}
