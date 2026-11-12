import "server-only";

import { getForumServices } from "./forum-container";
import type { ThreadFilter } from "./forum-display";
import { requireForumPageMember } from "./require-forum-page-member";

// Reads that feed the forum pages (T15b). Every one checks the member itself: a layout is not re-rendered
// on client navigation, so a page that read without checking would keep showing data after a revoke or a
// suspension. Results are the forum DTOs: public names only, never an email or a member id (the one id a page hands the browser is the draft's owner, below). `returnTo` is the
// calling page's own path, carried through the sign-in so the visitor lands back on it.

/** The signed-in member's id, for the forms: a draft kept in the browser is tied to it and given back only to the same member (D5). */
export async function getForumDraftOwner(returnTo?: string) {
  return (await requireForumPageMember(returnTo)).memberId;
}

/** The categories in display order, with the count of visible threads. */
export async function getForumCategories(returnTo?: string) {
  await requireForumPageMember(returnTo);
  return getForumServices().listCategories.execute();
}

/** One page of a category's visible threads, newest activity first. `page` out of range is clamped. */
export async function getForumThreads(categorySlug: string, page: number, returnTo?: string) {
  const member = await requireForumPageMember(returnTo);
  return getForumServices().listThreads.execute({ categorySlug, page, viewerId: member.memberId });
}

/** One page of the home list: the open or solved threads of every category, or of one. `page` out of range is clamped. */
export async function getForumFeed(options: { categorySlug?: string; state: ThreadFilter; page: number }, returnTo?: string) {
  const member = await requireForumPageMember(returnTo);
  return getForumServices().listFeed.execute({ ...options, viewerId: member.memberId });
}

/** A visible thread with its visible replies, oldest first. */
export async function getForumThread(threadId: string, returnTo?: string) {
  const member = await requireForumPageMember(returnTo);
  return getForumServices().getThread.execute({ threadId, viewerId: member.memberId });
}
