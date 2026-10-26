/*
 * The «me sirvió» votes of a thread. Counts and "did I vote": never who voted, so no member id, name or
 * email travels with them.
 */

export interface ForumReactionResult {
  count: number;
  mine: boolean;
}

export interface ForumThreadReactionsResult {
  thread: ForumReactionResult;
  /** Only the visible replies somebody reacted to; a reply missing here has none. */
  replies: Record<string, ForumReactionResult>;
}
