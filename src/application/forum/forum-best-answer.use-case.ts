import { assertCanPost, assertThreadAuthor, assertThreadOpen, ForumThreadLockedError } from "@/domain/forum";

import type { ForumMemberRepository, ForumPostRepository } from "../ports/forum.ports";
import { ForbiddenError, NotFoundError } from "../use-cases/use-case-error";

const NOT_FOUND = "Forum thread or reply not found";

export class MarkForumBestAnswerUseCase {
  constructor(
    private readonly members: ForumMemberRepository,
    private readonly posts: ForumPostRepository,
  ) {}

  /**
   * The thread's author marks one of its replies as the best answer, or takes the mark back with
   * `replyId: null`. The reply must be a visible reply of this very thread; a locked thread keeps its answer.
   */
  async execute(input: { memberId: string; threadId: string; replyId: string | null }): Promise<{ bestReplyId: string | null }> {
    const member = await this.members.findById(input.memberId);

    if (!member) {
      throw new ForbiddenError();
    }

    assertCanPost(member);

    const row = await this.posts.findThread(input.threadId);

    if (!row || row.thread.hiddenAt) {
      throw new NotFoundError(NOT_FOUND);
    }

    assertThreadAuthor(row.thread, member.id);
    assertThreadOpen(row.thread);

    if (input.replyId !== null) {
      const reply = await this.posts.findReply(input.replyId);

      if (!reply || reply.threadId !== row.thread.id || reply.hiddenAt) {
        throw new NotFoundError(NOT_FOUND);
      }
    }

    // The write checks all of it again under the row locks: a lock or a hide that landed after the reads above wins.
    const outcome = await this.posts.setBestReply(row.thread.id, input.replyId);

    if (outcome === "locked") {
      throw new ForumThreadLockedError();
    }

    if (outcome !== "ok") {
      throw new NotFoundError(NOT_FOUND);
    }

    return { bestReplyId: input.replyId };
  }
}
