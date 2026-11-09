"use server";

/*
 * The forum's student-facing server actions. The UI (T15b) binds these; every one answers
 * `ForumActionResult` and starts with the forum member guard, before it reads any input.
 *
 *   createForumThread(categorySlug, prevState, formData)   fields: title (1-120), body (1-10000)   -> { success, id }
 *   replyToForumThread(threadId, prevState, formData)      fields: body (1-5000)                    -> { success, id }
 *   editForumThread(threadId, prevState, formData)         fields: title, body (own thread only)
 *   editForumReply(replyId, prevState, formData)           fields: body (own reply only)
 *   signOutOfForum()
 *
 * Bodies are the Markdown subset with fenced code (see `markdown-subset`), stored as written and rendered
 * without HTML. A member posting too fast is told which limit and how many minutes to wait. Reads for pages: ./forum-read.
 *
 * These are NOT admin actions: `requireForumMember` accepts only a `forum_session`, never an admin one.
 */

import { closeForumSession } from "./forum-session-lifecycle";
import { getForumServices } from "./forum-container";
import { mapForumActionError, type ForumActionResult } from "./forum-action-result";
import { parseReplyFormData, parseThreadFormData } from "./forum-form-data";
import { requireForumMember } from "./require-forum-member";

export async function createForumThread(categorySlug: string, _prevState: ForumActionResult | null, formData: FormData): Promise<ForumActionResult> {
  try {
    const member = await requireForumMember();
    const thread = await getForumServices().createThread.execute({ memberId: member.memberId, categorySlug, ...parseThreadFormData(formData) });

    return { success: true, id: thread.id };
  } catch (error) {
    return mapForumActionError(error);
  }
}

export async function replyToForumThread(threadId: string, _prevState: ForumActionResult | null, formData: FormData): Promise<ForumActionResult> {
  try {
    const member = await requireForumMember();
    const reply = await getForumServices().reply.execute({ memberId: member.memberId, threadId, ...parseReplyFormData(formData) });

    return { success: true, id: reply.id };
  } catch (error) {
    return mapForumActionError(error);
  }
}

export async function editForumThread(threadId: string, _prevState: ForumActionResult | null, formData: FormData): Promise<ForumActionResult> {
  try {
    const member = await requireForumMember();
    const thread = await getForumServices().editThread.execute({ memberId: member.memberId, threadId, ...parseThreadFormData(formData) });

    return { success: true, id: thread.id };
  } catch (error) {
    return mapForumActionError(error);
  }
}

export async function editForumReply(replyId: string, _prevState: ForumActionResult | null, formData: FormData): Promise<ForumActionResult> {
  try {
    const member = await requireForumMember();
    const reply = await getForumServices().editReply.execute({ memberId: member.memberId, replyId, ...parseReplyFormData(formData) });

    return { success: true, id: reply.id };
  } catch (error) {
    return mapForumActionError(error);
  }
}

/** Signing out needs no member: with no valid session it just clears the cookie. */
export async function signOutOfForum(): Promise<ForumActionResult> {
  await closeForumSession();

  return { success: true };
}
