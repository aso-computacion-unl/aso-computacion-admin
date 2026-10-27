"use server";

/*
 * The best answer of a thread. The UI binds this; it answers `ForumActionResult` and starts with the forum
 * member guard, before it reads any input.
 *
 *   setForumBestAnswer(threadId, replyId)   replyId null takes the mark back   -> { success, id? }
 *
 * Only the thread's author may call it; the reply must be a visible reply of that same thread, and a
 * locked thread keeps its answer.
 */

import { getForumServices } from "./forum-container";
import { mapForumActionError, type ForumActionResult } from "./forum-action-result";
import { requireForumMember } from "./require-forum-member";

export async function setForumBestAnswer(threadId: string, replyId: string | null): Promise<ForumActionResult> {
  try {
    const member = await requireForumMember();
    const { bestReplyId } = await getForumServices().markBestAnswer.execute({ memberId: member.memberId, threadId, replyId: typeof replyId === "string" ? replyId : null });

    return bestReplyId ? { success: true, id: bestReplyId } : { success: true };
  } catch (error) {
    return mapForumActionError(error);
  }
}
