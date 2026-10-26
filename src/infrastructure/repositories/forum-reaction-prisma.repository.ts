import "server-only";

import { Prisma } from "@prisma/client";

import type { ForumPostTarget } from "@/application/ports/forum-moderation.ports";
import type { ForumReactionRepository, ForumThreadReactions } from "@/application/ports/forum-reactions.ports";
import { NotFoundError } from "@/application/use-cases/use-case-error";

import { prisma } from "../prisma/client";

const onTarget = (target: ForumPostTarget) => (target.kind === "thread" ? { threadId: target.id } : { replyId: target.id });

export class ForumReactionPrismaRepository implements ForumReactionRepository {
  async toggle(memberId: string, target: ForumPostTarget, reaction: { id: string; at: Date }): Promise<{ reacted: boolean; count: number }> {
    try {
      return await prisma.$transaction(async (tx) => {
        const removed = await tx.forumReaction.deleteMany({ where: { memberId, ...onTarget(target) } });

        if (removed.count === 0) {
          // ON CONFLICT DO NOTHING: a double click or a second device racing this one adds nothing instead of
          // failing (an error would abort the transaction). The unique indexes keep it one per member per post.
          await tx.forumReaction.createMany({ data: [{ id: reaction.id, memberId, createdAt: reaction.at, ...onTarget(target) }], skipDuplicates: true });
        }

        return { reacted: removed.count === 0, count: await tx.forumReaction.count({ where: onTarget(target) }) };
      });
    } catch (error) {
      // The post was deleted after the caller checked it.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
        throw new NotFoundError("Forum post not found");
      }

      throw error;
    }
  }

  async summarize(threadId: string, viewerId: string): Promise<ForumThreadReactions> {
    const visibleReply = { reply: { threadId, hiddenAt: null } };
    const [threadCount, threadMine, byReply, mineOnReplies] = await Promise.all([
      prisma.forumReaction.count({ where: { threadId } }),
      prisma.forumReaction.count({ where: { threadId, memberId: viewerId } }),
      prisma.forumReaction.groupBy({ by: ["replyId"], where: visibleReply, _count: { _all: true }, orderBy: { replyId: "asc" } }),
      prisma.forumReaction.findMany({ where: { ...visibleReply, memberId: viewerId }, select: { replyId: true } }),
    ]);
    const mine = new Set(mineOnReplies.map((row) => row.replyId));

    return {
      thread: { count: threadCount, mine: threadMine > 0 },
      replies: Object.fromEntries(byReply.flatMap((row) => (row.replyId ? [[row.replyId, { count: row._count._all, mine: mine.has(row.replyId) }]] : []))),
    };
  }
}
