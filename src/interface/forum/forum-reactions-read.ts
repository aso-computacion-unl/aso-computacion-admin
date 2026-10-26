import "server-only";

import { getForumServices } from "./forum-container";
import { requireForumPageMember } from "./require-forum-page-member";

/** The «me sirvió» counts of a visible thread and its visible replies, with what the viewer left. Counts only: never who. */
export async function getForumReactions(threadId: string) {
  const member = await requireForumPageMember();
  return getForumServices().getReactions.execute({ threadId, viewerId: member.memberId });
}
