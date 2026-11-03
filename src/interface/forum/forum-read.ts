import "server-only";

import { getForumServices } from "./forum-container";
import { requireForumPageMember } from "./require-forum-page-member";

// Reads that feed the forum pages (T15b). Every one checks the member itself: a layout is not re-rendered
// on client navigation, so a page that read without checking would keep showing data after a revoke or a
// suspension. Results are the forum DTOs: public names only, never an email or a member id.

/** The categories in display order, with the count of visible threads. */
export async function getForumCategories() {
  await requireForumPageMember();
  return getForumServices().listCategories.execute();
}

/** One page of a category's visible threads, newest activity first. `page` out of range is clamped. */
export async function getForumThreads(categorySlug: string, page: number) {
  const member = await requireForumPageMember();
  return getForumServices().listThreads.execute({ categorySlug, page, viewerId: member.memberId });
}

/** A visible thread with its visible replies, oldest first. */
export async function getForumThread(threadId: string) {
  const member = await requireForumPageMember();
  return getForumServices().getThread.execute({ threadId, viewerId: member.memberId });
}
