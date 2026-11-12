import "server-only";

import type { ForumReply as ForumReplyRow, ForumThread as ForumThreadRecord } from "@/generated/prisma/client";

import type { ForumAddReplyOutcome, ForumBestAnswerOutcome, ForumEditOutcome, ForumPostRepository, ForumReplyRow as ReplyRow, ForumThreadRow, ForumThreadState } from "@/application/ports/forum.ports";
import type { ForumReply, ForumThread } from "@/domain/forum";

import { prisma } from "../prisma/client";

const toThread = (row: ForumThreadRecord): ForumThread => ({
  id: row.id,
  categoryId: row.categoryId,
  authorId: row.authorId,
  title: row.title,
  body: row.body,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
  editedAt: row.editedAt,
  lastActivityAt: row.lastActivityAt,
  lockedAt: row.lockedAt,
  hiddenAt: row.hiddenAt,
  bestReplyId: row.bestReplyId,
});

const toReply = (row: ForumReplyRow): ForumReply => ({
  id: row.id,
  threadId: row.threadId,
  authorId: row.authorId,
  body: row.body,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
  editedAt: row.editedAt,
  hiddenAt: row.hiddenAt,
});

/** Only the author's public name is ever read with a post; the email never leaves the table. */
const WITH_AUTHOR_NAME = {
  author: { select: { displayName: true } },
  _count: { select: { replies: { where: { hiddenAt: null } } } },
} as const;

export class ForumPostPrismaRepository implements ForumPostRepository {
  async create(thread: ForumThread): Promise<void> {
    await prisma.forumThread.create({ data: thread });
  }

  async findThread(id: string): Promise<ForumThreadRow | null> {
    const row = await prisma.forumThread.findUnique({ where: { id }, include: WITH_AUTHOR_NAME });

    return row && { thread: toThread(row), authorName: row.author.displayName, replyCount: row._count.replies };
  }

  async listThreads(categoryId: string, page: { offset: number; limit: number }): Promise<{ items: ForumThreadRow[]; total: number }> {
    const where = { categoryId, hiddenAt: null };
    const [rows, total] = await prisma.$transaction([
      // id breaks the last tie so the order is stable between reads.
      prisma.forumThread.findMany({ where, orderBy: [{ lastActivityAt: "desc" }, { id: "desc" }], skip: page.offset, take: page.limit, include: WITH_AUTHOR_NAME }),
      prisma.forumThread.count({ where }),
    ]);

    return { items: rows.map((row) => ({ thread: toThread(row), authorName: row.author.displayName, replyCount: row._count.replies })), total };
  }

  async listFeed(scope: { categoryId?: string; state: ForumThreadState }, page: { offset: number; limit: number }): Promise<{ items: ForumThreadRow[]; counts: Record<ForumThreadState, number> }> {
    const base = { hiddenAt: null, ...(scope.categoryId === undefined ? {} : { categoryId: scope.categoryId }) };
    // A thread is solved while it has a best answer: setting and clearing the mark is what moves it between tabs.
    const open = { ...base, bestReplyId: null };
    const solved = { ...base, bestReplyId: { not: null } };
    const [rows, openCount, solvedCount] = await prisma.$transaction([
      prisma.forumThread.findMany({ where: scope.state === "solved" ? solved : open, orderBy: [{ lastActivityAt: "desc" }, { id: "desc" }], skip: page.offset, take: page.limit, include: WITH_AUTHOR_NAME }),
      prisma.forumThread.count({ where: open }),
      prisma.forumThread.count({ where: solved }),
    ]);

    return { items: rows.map((row) => ({ thread: toThread(row), authorName: row.author.displayName, replyCount: row._count.replies })), counts: { open: openCount, solved: solvedCount } };
  }

  async updateThread(id: string, change: { title: string; body: string; at: Date; authorId: string }): Promise<ForumEditOutcome> {
    // One conditional statement: a lock or a hide committing first makes it match nothing.
    const { count } = await prisma.forumThread.updateMany({
      where: { id, authorId: change.authorId, hiddenAt: null, lockedAt: null },
      data: { title: change.title, body: change.body, editedAt: change.at, updatedAt: change.at },
    });

    if (count > 0) {
      return "ok";
    }

    const thread = await prisma.forumThread.findUnique({ where: { id }, select: { authorId: true, hiddenAt: true } });

    return !thread || thread.hiddenAt || thread.authorId !== change.authorId ? "not-found" : "locked";
  }

  async addReply(reply: ForumReply): Promise<ForumAddReplyOutcome> {
    return prisma.$transaction(async (tx) => {
      // The conditional update takes the thread's row lock: a lock or a hide committing first makes it
      // match nothing, and one committing after waits for this transaction.
      const { count } = await tx.forumThread.updateMany({
        where: { id: reply.threadId, lockedAt: null, hiddenAt: null },
        data: { lastActivityAt: reply.createdAt },
      });

      if (count === 0) {
        const thread = await tx.forumThread.findUnique({ where: { id: reply.threadId }, select: { hiddenAt: true } });

        return !thread || thread.hiddenAt ? "not-found" : "locked";
      }

      await tx.forumReply.create({ data: reply });

      return "ok";
    });
  }

  async setBestReply(threadId: string, replyId: string | null): Promise<ForumBestAnswerOutcome> {
    return prisma.$transaction(async (tx) => {
      if (replyId !== null) {
        // A shared lock on the reply while it is visible and in this thread: a hide committing first matches
        // nothing here, and one arriving later waits for this transaction and then clears the mark.
        const found = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "ForumReply" WHERE "id" = ${replyId} AND "threadId" = ${threadId} AND "hiddenAt" IS NULL FOR SHARE`;

        if (found.length === 0) {
          const thread = await tx.forumThread.findUnique({ where: { id: threadId }, select: { hiddenAt: true } });

          return !thread || thread.hiddenAt ? "not-found" : "invalid-reply";
        }
      }

      const { count } = await tx.forumThread.updateMany({ where: { id: threadId, hiddenAt: null, lockedAt: null }, data: { bestReplyId: replyId } });

      if (count > 0) {
        return "ok";
      }

      const thread = await tx.forumThread.findUnique({ where: { id: threadId }, select: { hiddenAt: true } });

      return !thread || thread.hiddenAt ? "not-found" : "locked";
    });
  }

  async listReplies(threadId: string): Promise<ReplyRow[]> {
    const rows = await prisma.forumReply.findMany({
      where: { threadId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      include: { author: { select: { displayName: true } } },
    });

    return rows.map((row) => ({ reply: toReply(row), authorName: row.author.displayName }));
  }

  async findReply(id: string): Promise<ForumReply | null> {
    const row = await prisma.forumReply.findUnique({ where: { id } });

    return row && toReply(row);
  }

  async updateReply(id: string, change: { body: string; at: Date; authorId: string }): Promise<ForumEditOutcome> {
    return prisma.$transaction(async (tx) => {
      // Row locks in the order every writer takes them (a hide, marking the best answer, a reaction): the
      // reply first, then its thread. Taking the thread first could wait for a reply that a hide already
      // holds while the hide waits for the thread, a deadlock.
      const found = await tx.$queryRaw<{ threadId: string }[]>`SELECT "threadId" FROM "ForumReply" WHERE "id" = ${id} AND "authorId" = ${change.authorId} AND "hiddenAt" IS NULL FOR UPDATE`;

      const threadId = found[0]?.threadId;

      if (threadId === undefined) {
        return "not-found";
      }

      // A shared row lock on the thread while it is open: a lock or a hide committing first matches
      // nothing here, and one arriving later waits for this transaction.
      const open = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "ForumThread" WHERE "id" = ${threadId} AND "lockedAt" IS NULL AND "hiddenAt" IS NULL FOR SHARE`;

      if (open.length === 0) {
        const thread = await tx.forumThread.findUnique({ where: { id: threadId }, select: { hiddenAt: true } });

        return !thread || thread.hiddenAt ? "not-found" : "locked";
      }

      const { count } = await tx.forumReply.updateMany({ where: { id, hiddenAt: null }, data: { body: change.body, editedAt: change.at, updatedAt: change.at } });

      if (count === 0) {
        return "not-found";
      }

      await tx.forumThread.updateMany({ where: { id: threadId, bestReplyId: id }, data: { bestReplyId: null } });

      return "ok";
    });
  }

  async countPostsSince(memberId: string, since: Date): Promise<number> {
    const [threads, replies] = await Promise.all([
      prisma.forumThread.count({ where: { authorId: memberId, createdAt: { gte: since } } }),
      prisma.forumReply.count({ where: { authorId: memberId, createdAt: { gte: since } } }),
    ]);

    return threads + replies;
  }

  async oldestPostSince(memberId: string, since: Date): Promise<Date | null> {
    const where = { authorId: memberId, createdAt: { gte: since } };
    const [thread, reply] = await Promise.all([
      prisma.forumThread.findFirst({ where, orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
      prisma.forumReply.findFirst({ where, orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
    ]);
    const times = [thread, reply].flatMap((post) => (post ? [post.createdAt.getTime()] : []));

    return times.length === 0 ? null : new Date(Math.min(...times));
  }
}
