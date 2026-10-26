import { DomainError, ValidationError } from "./domain-error";
import { optionalText, requiredText } from "./text";

export const FORUM_MEMBER_NAME_MAX_LENGTH = 60;
export const FORUM_CATEGORY_NAME_MAX_LENGTH = 60;
export const FORUM_CATEGORY_DESCRIPTION_MAX_LENGTH = 200;
export const FORUM_THREAD_TITLE_MAX_LENGTH = 120;
export const FORUM_THREAD_BODY_MAX_LENGTH = 10000;
export const FORUM_REPLY_BODY_MAX_LENGTH = 5000;
export const FORUM_REPORT_REASON_MAX_LENGTH = 500;
export const FORUM_REPORT_NOTE_MAX_LENGTH = 500;

export const FORUM_MEMBER_STATUSES = ["ACTIVE", "SUSPENDED"] as const;
export type ForumMemberStatus = (typeof FORUM_MEMBER_STATUSES)[number];

/**
 * A student who signed in with their institutional Google account. Not a `User`: a member can never
 * act in the admin. `email` (lower-cased) and `googleSub` identify the person and never leave the server.
 */
export interface ForumMember {
  id: string;
  email: string;
  googleSub: string;
  /** What other students see. Never derived from the email. */
  displayName: string;
  status: ForumMemberStatus;
  suspendedAt: Date | null;
  createdAt: Date;
  lastLoginAt: Date | null;
}

export interface ForumCategory {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ForumThread {
  id: string;
  categoryId: string;
  authorId: string;
  title: string;
  /** Markdown subset with fenced code (see `markdown-subset`); stored as written, never as HTML. */
  body: string;
  createdAt: Date;
  updatedAt: Date;
  /** Set only by an edit of the title or the body. */
  editedAt: Date | null;
  lastActivityAt: Date;
  lockedAt: Date | null;
  hiddenAt: Date | null;
  bestReplyId: string | null;
}

export interface ForumReply {
  id: string;
  threadId: string;
  authorId: string;
  body: string;
  createdAt: Date;
  updatedAt: Date;
  editedAt: Date | null;
  hiddenAt: Date | null;
}

export const FORUM_REPORT_STATUSES = ["OPEN", "RESOLVED", "DISMISSED"] as const;
export type ForumReportStatus = (typeof FORUM_REPORT_STATUSES)[number];

/**
 * A student's report of a thread or a reply (exactly one of `threadId` and `replyId`). It stays OPEN until
 * a moderator closes it as RESOLVED (acted on) or DISMISSED. `resolvedBy` is the admin `User` id (null for
 * an emergency session). The reporter is for moderators only.
 */
export interface ForumReport {
  id: string;
  reporterId: string;
  threadId: string | null;
  replyId: string | null;
  reason: string;
  status: ForumReportStatus;
  createdAt: Date;
  resolvedAt: Date | null;
  resolvedBy: string | null;
  resolutionNote: string | null;
}

/** Raised when a suspended member tries to post or edit. */
export class ForumMemberSuspendedError extends DomainError {
  constructor() {
    super("The forum account is suspended");
    this.name = "ForumMemberSuspendedError";
  }
}

/** Raised when a reply is posted to, or a post is edited in, a locked thread. */
export class ForumThreadLockedError extends DomainError {
  constructor() {
    super("The thread is locked");
    this.name = "ForumThreadLockedError";
  }
}

/** Raised when someone but the author of a thread tries to mark or clear its best answer. */
export class ForumNotThreadAuthorError extends DomainError {
  constructor() {
    super("Only the author of the thread can choose its best answer");
    this.name = "ForumNotThreadAuthorError";
  }
}

/** Raised when a member reports a post they already have an open report on. */
export class ForumAlreadyReportedError extends DomainError {
  constructor() {
    super("The post already has an open report from this member");
    this.name = "ForumAlreadyReportedError";
  }
}

/** Raised when a moderator closes a report somebody else already closed. */
export class ForumReportAlreadyClosedError extends DomainError {
  constructor() {
    super("The report is already closed");
    this.name = "ForumReportAlreadyClosedError";
  }
}

/** Raised when someone edits a post that is not theirs (or is hidden by a moderator). */
export class ForumPostNotOwnedError extends DomainError {
  constructor() {
    super("The post cannot be edited by this member");
    this.name = "ForumPostNotOwnedError";
  }
}

// Control characters (including NUL, which Postgres cannot store) and the bidirectional overrides that
// could make a name read as something else.
const UNSAFE_NAME_CHARACTERS = /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g;
const NUL = /\u0000/;

/**
 * The name other students see. It comes from the Google profile; when that is missing or looks like an
 * address, it is a neutral "Estudiante" plus four characters of the member id, so an email (or its
 * local part) never becomes public by accident.
 */
export function parseDisplayName(raw: string | undefined, memberId: string): string {
  const name = (raw ?? "")
    .replace(UNSAFE_NAME_CHARACTERS, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, FORUM_MEMBER_NAME_MAX_LENGTH)
    .trim();

  return name === "" || name.includes("@") ? `Estudiante ${memberId.slice(0, 4)}` : name;
}

function postText(field: string, raw: string, max: number): string {
  if (NUL.test(raw)) {
    throw new ValidationError(field, `${field} must not contain control characters`);
  }

  return requiredText(field, raw.replace(/\r\n?/g, "\n"), max);
}

export const parseThreadTitle = (raw: string): string => postText("title", raw, FORUM_THREAD_TITLE_MAX_LENGTH);
export const parseThreadBody = (raw: string): string => postText("body", raw, FORUM_THREAD_BODY_MAX_LENGTH);
export const parseReplyBody = (raw: string): string => postText("body", raw, FORUM_REPLY_BODY_MAX_LENGTH);

export const parseReportReason = (raw: string): string => postText("reason", raw, FORUM_REPORT_REASON_MAX_LENGTH);
export const parseResolutionNote = (raw: string | null | undefined): string | null => {
  if (raw && NUL.test(raw)) {
    throw new ValidationError("note", "note must not contain control characters");
  }

  return optionalText("note", raw, FORUM_REPORT_NOTE_MAX_LENGTH);
};

export const parseCategoryName = (raw: string): string => requiredText("name", raw, FORUM_CATEGORY_NAME_MAX_LENGTH);
export const parseCategoryDescription = (raw: string | null | undefined): string | null =>
  optionalText("description", raw, FORUM_CATEGORY_DESCRIPTION_MAX_LENGTH);

export function assertCanPost(member: Pick<ForumMember, "status">): void {
  if (member.status !== "ACTIVE") {
    throw new ForumMemberSuspendedError();
  }
}

/** A locked thread is read-only for students: no new replies and no edits, not even of their own posts. */
export function assertThreadOpen(thread: Pick<ForumThread, "lockedAt">): void {
  if (thread.lockedAt !== null) {
    throw new ForumThreadLockedError();
  }
}

export function assertCanEditPost(post: { authorId: string; hiddenAt: Date | null }, memberId: string): void {
  if (post.authorId !== memberId || post.hiddenAt !== null) {
    throw new ForumPostNotOwnedError();
  }
}

export function assertThreadAuthor(thread: Pick<ForumThread, "authorId">, memberId: string): void {
  if (thread.authorId !== memberId) {
    throw new ForumNotThreadAuthorError();
  }
}
