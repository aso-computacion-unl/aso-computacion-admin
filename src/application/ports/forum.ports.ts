import type { ForumCategory, ForumMember, ForumReply, ForumThread } from "@/domain/forum";

export interface ForumMemberRepository {
  findById(id: string): Promise<ForumMember | null>;
  findByGoogleSub(sub: string): Promise<ForumMember | null>;
  findByEmail(email: string): Promise<ForumMember | null>;
  /** False when the email or the Google sub is already taken (decided by the unique indexes, not a read). */
  create(member: ForumMember): Promise<boolean>;
  recordLogin(id: string, at: Date): Promise<void>;
}

export interface ForumSessionRecord {
  id: string;
  memberId: string;
  createdAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  lastSeenAt: Date;
  userAgent: string | null;
  /** Salted hash, never the address. */
  ipHash: string | null;
}

export interface ForumSessionRepository {
  create(session: ForumSessionRecord): Promise<void>;
  findWithMember(id: string): Promise<{ session: ForumSessionRecord; member: ForumMember } | null>;
  touch(id: string, at: Date): Promise<void>;
  /** True when the session was active and is now revoked. */
  revoke(id: string, at: Date): Promise<boolean>;
}

export interface ForumCategoryWithCount {
  category: ForumCategory;
  /** Threads a student can see (not hidden). */
  threadCount: number;
}

export type ForumCategoryDeleteOutcome = "ok" | "not-found" | "not-empty";

export interface ForumCategoryRepository {
  /** Display order: `sortOrder`, then oldest first. */
  list(): Promise<ForumCategoryWithCount[]>;
  findById(id: string): Promise<ForumCategory | null>;
  findBySlug(slug: string): Promise<ForumCategory | null>;
  /** The next free `sortOrder` (after the last category). */
  nextSortOrder(): Promise<number>;
  /** False when the slug is already used (decided by the unique index). */
  create(category: ForumCategory): Promise<boolean>;
  /** False when the slug is already used by another category; throws `NotFoundError` for an unknown id. */
  update(category: ForumCategory): Promise<boolean>;
  /** Refused, and nothing changes, while the category still has threads of any visibility. */
  delete(id: string): Promise<ForumCategoryDeleteOutcome>;
}

export interface ForumThreadRow {
  thread: ForumThread;
  authorName: string;
  /** Replies a student can see (not hidden). */
  replyCount: number;
}

export interface ForumReplyRow {
  reply: ForumReply;
  authorName: string;
}

export type ForumAddReplyOutcome = "ok" | "not-found" | "locked";

/** "not-found": the thread is gone or hidden. "invalid-reply": the reply is not a visible reply of this very thread. */
export type ForumBestAnswerOutcome = "ok" | "not-found" | "locked" | "invalid-reply";

/** "not-found" also covers a hidden post (or one in a hidden thread) and one that is not the author's. */
export type ForumEditOutcome = "ok" | "not-found" | "locked";

/** The two tabs of the thread list: a thread with a best answer is solved, every other visible thread is open (a locked one too). */
export type ForumThreadState = "open" | "solved";

export interface ForumPostRepository {
  create(thread: ForumThread): Promise<void>;
  /** Hidden threads included: whether a student may see one is the use case's decision. */
  findThread(id: string): Promise<ForumThreadRow | null>;
  /** Not hidden, most recent activity first. */
  listThreads(categoryId: string, page: { offset: number; limit: number }): Promise<{ items: ForumThreadRow[]; total: number }>;
  /**
   * Not hidden threads of one category, or of every category when `categoryId` is omitted, in the given state,
   * most recent activity first. `counts` are the visible threads of the same scope in each state, whichever is listed.
   */
  listFeed(scope: { categoryId?: string; state: ForumThreadState }, page: { offset: number; limit: number }): Promise<{ items: ForumThreadRow[]; counts: Record<ForumThreadState, number> }>;
  /**
   * Sets the title and body and stamps `editedAt` and `updatedAt` with `at`, atomically with the check that
   * the thread is the author's, not hidden and not locked: a moderator's lock or hide that landed after
   * the caller read the thread wins.
   */
  updateThread(id: string, change: { title: string; body: string; at: Date; authorId: string }): Promise<ForumEditOutcome>;
  /**
   * Adds the reply and moves the thread's `lastActivityAt` to the reply's time, atomically with the
   * check that the thread exists, is not hidden and is not locked: a lock racing a reply cannot lose.
   */
  addReply(reply: ForumReply): Promise<ForumAddReplyOutcome>;
  /**
   * Sets (or, with null, clears) the thread's best answer, atomically with the checks that the thread is
   * neither hidden nor locked and that the reply belongs to this thread and is not hidden. A hide that
   * lands after the caller read the reply wins: the foreign key alone cannot tell which thread a reply is in.
   */
  setBestReply(threadId: string, replyId: string | null): Promise<ForumBestAnswerOutcome>;
  /** Oldest first, hidden replies included (`hiddenAt` set): the thread shows a placeholder for them. */
  listReplies(threadId: string): Promise<ForumReplyRow[]>;
  findReply(id: string): Promise<ForumReply | null>;
  /**
   * Same re-check for a reply (the author's, not hidden, in a thread that is neither hidden nor locked). An
   * edited reply stops being the thread's best answer in the same step, so the mark never vouches for text
   * the thread author did not read.
   */
  updateReply(id: string, change: { body: string; at: Date; authorId: string }): Promise<ForumEditOutcome>;
  /** Threads plus replies written by the member since `since`: what the posting throttle counts. */
  countPostsSince(memberId: string, since: Date): Promise<number>;
  /** When the member's oldest thread or reply since `since` was written, or null when there is none: the post whose leaving the window frees the throttle. */
  oldestPostSince(memberId: string, since: Date): Promise<Date | null>;
}
