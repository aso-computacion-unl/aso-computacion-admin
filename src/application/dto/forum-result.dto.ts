/*
 * What the forum shows. Nothing here carries an email, a Google id or a member id: other students are
 * only ever a public name, and "this is mine" is a boolean the server computed for the viewer.
 */

export interface ForumCategoryResult {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  sortOrder: number;
  /** Threads a student can see (not hidden). */
  threadCount: number;
}

export interface ForumThreadListItemResult {
  id: string;
  title: string;
  authorName: string;
  createdAt: Date;
  lastActivityAt: Date;
  replyCount: number;
  locked: boolean;
  hasBestAnswer: boolean;
  mine: boolean;
}

export interface ForumThreadResult {
  id: string;
  title: string;
  /** Markdown subset with fenced code, as written: rendered by `markdown-subset`, never as raw HTML. */
  body: string;
  authorName: string;
  createdAt: Date;
  editedAt: Date | null;
  locked: boolean;
  bestReplyId: string | null;
  mine: boolean;
}

export interface ForumReplyResult {
  id: string;
  body: string;
  authorName: string;
  createdAt: Date;
  editedAt: Date | null;
  isBest: boolean;
  mine: boolean;
}
