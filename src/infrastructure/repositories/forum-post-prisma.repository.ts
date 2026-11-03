import "server-only";

import type { ForumReply as ForumReplyRow, ForumThread as ForumThreadRecord } from "@prisma/client";

import type { ForumAddReplyOutcome, ForumPostRepository, ForumReplyRow as ReplyRow, ForumThreadRow } from "@/application/ports/forum.ports";
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

  async updateThread(id: string, change: { title: string; body: string; at: Date }): Promise<void> {
    await prisma.forumThread.updateMany({ where: { id }, data: { title: change.title, body: change.body, editedAt: change.at, updatedAt: change.at } });
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

  async listReplies(threadId: string): Promise<ReplyRow[]> {
    const rows = await prisma.forumReply.findMany({
      where: { threadId, hiddenAt: null },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      include: { author: { select: { displayName: true } } },
    });

    return rows.map((row) => ({ reply: toReply(row), authorName: row.author.displayName }));
  }

  async findReply(id: string): Promise<ForumReply | null> {
    const row = await prisma.forumReply.findUnique({ where: { id } });

    return row && toReply(row);
  }

  async updateReply(id: string, change: { body: string; at: Date }): Promise<void> {
    await prisma.forumReply.updateMany({ where: { id }, data: { body: change.body, editedAt: change.at, updatedAt: change.at } });
  }

  async countPostsSince(memberId: string, since: Date): Promise<number> {
    const [threads, replies] = await Promise.all([
      prisma.forumThread.count({ where: { authorId: memberId, createdAt: { gte: since } } }),
      prisma.forumReply.count({ where: { authorId: memberId, createdAt: { gte: since } } }),
    ]);

    return threads + replies;
  }
}
