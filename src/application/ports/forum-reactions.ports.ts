import type { ForumPostTarget } from "./forum-moderation.ports";

/** How many «me sirvió» a post has, and whether the viewer left one. */
export interface ForumReactionSummary {
  count: number;
  mine: boolean;
}

export interface ForumThreadReactions {
  thread: ForumReactionSummary;
  /** Only the visible replies somebody reacted to; a reply missing here has none. */
  replies: Record<string, ForumReactionSummary>;
}

export interface ForumReactionRepository {
  /**
   * Adds the member's reaction to the post, or takes it back when there is one, and answers the state and
   * the count after. One per member per post: the unique indexes decide, so a double click or two devices
   * cannot add two. Re-checks inside its transaction, under row locks, that the member is still active
   * (`ForumMemberSuspendedError`) and the post still visible (`NotFoundError`), so a suspension or a hide that
   * lands after the caller looked wins.
   */
  toggle(memberId: string, target: ForumPostTarget, reaction: { id: string; at: Date }): Promise<{ reacted: boolean; count: number }>;
  summarize(threadId: string, viewerId: string): Promise<ForumThreadReactions>;
}
