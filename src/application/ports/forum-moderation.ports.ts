import type { ForumReport } from "@/domain/forum";

/** A thread or a reply: what a student reports and a moderator hides. */
export type ForumPostTarget = { kind: "thread"; id: string } | { kind: "reply"; id: string };

/** The post a report is about, as a moderator needs to judge it. Carries no email. */
export interface ForumReportedPost {
  kind: "thread" | "reply";
  /** The thread itself, or the thread the reply belongs to: where the post lives. */
  threadId: string;
  threadTitle: string;
  /** The post's own text as written; the use case cuts it to an excerpt. */
  body: string;
  authorId: string;
  authorName: string;
  authorSuspended: boolean;
  /** The post itself is hidden from students. */
  hidden: boolean;
  /** The thread is locked. */
  locked: boolean;
}

export interface ForumReportRow {
  report: ForumReport;
  reporterName: string;
  post: ForumReportedPost;
}

export type ForumReportQueue = "open" | "closed";

/** What a moderator did, and when; `by` is the admin `User` id (null for an emergency session). */
export interface ForumModerationStamp {
  at: Date;
  by: string | null;
}

export interface ForumModerationRepository {
  /** False when the reporter already has an OPEN report on the target (decided by the partial unique index, not a read). */
  createReport(report: ForumReport): Promise<boolean>;
  /** Open: oldest first (the queue). Closed: most recently closed first. */
  listReports(queue: ForumReportQueue, page: { offset: number; limit: number }): Promise<{ items: ForumReportRow[]; total: number }>;
  /** "closed" when somebody else got there first (the report was not OPEN any more). */
  closeReport(id: string, change: ForumModerationStamp & { status: "RESOLVED" | "DISMISSED"; note: string | null }): Promise<"ok" | "not-found" | "closed">;
  /** Hiding keeps the first time. Hiding a reply also clears it as its thread's best answer. False for an unknown post. */
  setPostHidden(target: ForumPostTarget, hidden: boolean, stamp: ForumModerationStamp): Promise<boolean>;
  /** Locking keeps the first time. False for an unknown thread. */
  setThreadLocked(threadId: string, locked: boolean, stamp: ForumModerationStamp): Promise<boolean>;
  /** Suspending also revokes every live session of the member, in the same step. Keeps the first time. False for an unknown member. */
  setMemberSuspended(memberId: string, suspended: boolean, stamp: ForumModerationStamp): Promise<boolean>;
}
