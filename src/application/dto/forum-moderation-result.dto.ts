/*
 * What the moderation queue shows. Nothing here carries an email or a Google id. `authorId` is the member's
 * internal id, the handle a moderator needs to suspend the account; it is for the admin only and never
 * reaches a student page.
 */

export interface ForumReportItemResult {
  id: string;
  status: "OPEN" | "RESOLVED" | "DISMISSED";
  reason: string;
  createdAt: Date;
  reporterName: string;
  resolvedAt: Date | null;
  resolutionNote: string | null;
  target: {
    kind: "thread" | "reply";
    threadId: string;
    /** Set when the report is about a reply; with `kind` it names the post to hide. */
    replyId: string | null;
    threadTitle: string;
    /** The start of the post's text, enough to judge a report without opening the thread. */
    excerpt: string;
    authorId: string;
    authorName: string;
    authorSuspended: boolean;
    hidden: boolean;
    locked: boolean;
  };
}
