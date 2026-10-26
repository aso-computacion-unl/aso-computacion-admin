"use server";

/*
 * «Me sirvió» reactions. The UI binds these; every one answers `ForumActionResult` and starts with the
 * forum member guard, before it reads any input.
 *
 *   toggleForumThreadReaction(threadId)   -> { success, reacted, count }
 *   toggleForumReplyReaction(replyId)     -> { success, reacted, count }
 *
 * One reaction per member per post: the second call takes it back. A locked thread still takes reactions.
 * Counts for a page come from `getForumReactions` in ./forum-reactions-read.
 */

import { getForumServices } from "./forum-container";
import { mapForumActionError, type ForumActionResult } from "./forum-action-result";
import { requireForumMember } from "./require-forum-member";

export async function toggleForumThreadReaction(threadId: string): Promise<ForumActionResult> {
  try {
    const member = await requireForumMember();
    const { reacted, count } = await getForumServices().toggleReaction.execute({ memberId: member.memberId, target: { kind: "thread", id: threadId } });

    return { success: true, reacted, count };
  } catch (error) {
    return mapForumActionError(error);
  }
}

export async function toggleForumReplyReaction(replyId: string): Promise<ForumActionResult> {
  try {
    const member = await requireForumMember();
    const { reacted, count } = await getForumServices().toggleReaction.execute({ memberId: member.memberId, target: { kind: "reply", id: replyId } });

    return { success: true, reacted, count };
  } catch (error) {
    return mapForumActionError(error);
  }
}
