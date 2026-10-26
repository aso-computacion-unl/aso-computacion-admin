"use server";

/*
 * The forum's student-facing moderation actions. The UI binds these; every one answers `ForumActionResult`
 * and starts with the forum member guard, before it reads any input.
 *
 *   reportForumThread(threadId, prevState, formData)   fields: reason (1-500)
 *   reportForumReply(replyId, prevState, formData)     fields: reason (1-500)
 *
 * A member has one open report per post: reporting it again while a moderator has not closed the first
 * answers "already reported". Moderators work the queue in `/admin/foro/reportes`.
 */

import { getForumServices } from "./forum-container";
import { mapForumActionError, type ForumActionResult } from "./forum-action-result";
import { parseReportFormData } from "./forum-form-data";
import { requireForumMember } from "./require-forum-member";

export async function reportForumThread(threadId: string, _prevState: ForumActionResult | null, formData: FormData): Promise<ForumActionResult> {
  try {
    const member = await requireForumMember();
    await getForumServices().reportPost.execute({ memberId: member.memberId, target: { kind: "thread", id: threadId }, ...parseReportFormData(formData) });

    return { success: true };
  } catch (error) {
    return mapForumActionError(error);
  }
}

export async function reportForumReply(replyId: string, _prevState: ForumActionResult | null, formData: FormData): Promise<ForumActionResult> {
  try {
    const member = await requireForumMember();
    await getForumServices().reportPost.execute({ memberId: member.memberId, target: { kind: "reply", id: replyId }, ...parseReportFormData(formData) });

    return { success: true };
  } catch (error) {
    return mapForumActionError(error);
  }
}
