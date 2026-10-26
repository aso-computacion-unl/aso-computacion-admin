import {
  assertCanEditPost,
  assertCanPost,
  assertThreadAcceptsReplies,
  ForumThreadLockedError,
  parseReplyBody,
  parseThreadBody,
  parseThreadTitle,
  type ForumMember,
  type ForumReply,
  type ForumThread,
} from "@/domain/forum";

import type { ForumReplyResult, ForumThreadListItemResult, ForumThreadResult } from "../dto/forum-result.dto";
import type { ForumCategoryRepository, ForumMemberRepository, ForumPostRepository, ForumReplyRow, ForumThreadRow } from "../ports/forum.ports";
import { ForbiddenError, NotFoundError } from "../use-cases/use-case-error";
import type { PostingThrottle } from "./posting-throttle";

export const FORUM_THREADS_PAGE_SIZE = 20;

type Clock = () => Date;
type IdGenerator = () => string;

const THREAD_NOT_FOUND = "Forum thread not found";

function toThreadResult({ thread, authorName }: ForumThreadRow, viewerId: string): ForumThreadResult {
  return {
    id: thread.id,
    title: thread.title,
    body: thread.body,
    authorName,
    createdAt: thread.createdAt,
    editedAt: thread.editedAt,
    locked: thread.lockedAt !== null,
    bestReplyId: thread.bestReplyId,
    mine: thread.authorId === viewerId,
  };
}

function toReplyResult({ reply, authorName }: ForumReplyRow, viewerId: string, bestReplyId: string | null): ForumReplyResult {
  return {
    id: reply.id,
    body: reply.body,
    authorName,
    createdAt: reply.createdAt,
    editedAt: reply.editedAt,
    isBest: reply.id === bestReplyId,
    mine: reply.authorId === viewerId,
  };
}

/** The member behind an action, who must still be allowed to post: the session was valid, but the account may have changed since. */
async function activeMember(members: ForumMemberRepository, memberId: string): Promise<ForumMember> {
  const member = await members.findById(memberId);

  if (!member) {
    throw new ForbiddenError();
  }

  assertCanPost(member);

  return member;
}

/** A thread a student can see; a hidden one is as good as gone. */
async function visibleThread(posts: ForumPostRepository, threadId: string): Promise<ForumThreadRow> {
  const row = await posts.findThread(threadId);

  if (!row || row.thread.hiddenAt) {
    throw new NotFoundError(THREAD_NOT_FOUND);
  }

  return row;
}

export interface ForumThreadsPage {
  category: { id: string; slug: string; name: string; description: string | null };
  items: ForumThreadListItemResult[];
  total: number;
  page: number;
  pageCount: number;
}

export class ListForumThreadsUseCase {
  constructor(
    private readonly categories: ForumCategoryRepository,
    private readonly posts: ForumPostRepository,
  ) {}

  async execute(input: { categorySlug: string; page: number; viewerId: string }): Promise<ForumThreadsPage> {
    const category = await this.categories.findBySlug(input.categorySlug);

    if (!category) {
      throw new NotFoundError("Forum category not found");
    }

    const requested = Number.isInteger(input.page) && input.page >= 1 ? input.page : 1;
    const first = await this.posts.listThreads(category.id, { offset: (requested - 1) * FORUM_THREADS_PAGE_SIZE, limit: FORUM_THREADS_PAGE_SIZE });
    const pageCount = Math.max(1, Math.ceil(first.total / FORUM_THREADS_PAGE_SIZE));
    const page = Math.min(requested, pageCount);
    // A page past the end (a stale link, an edited URL) shows the last page, not an empty one.
    const { items, total } = page === requested ? first : await this.posts.listThreads(category.id, { offset: (page - 1) * FORUM_THREADS_PAGE_SIZE, limit: FORUM_THREADS_PAGE_SIZE });

    return {
      category: { id: category.id, slug: category.slug, name: category.name, description: category.description },
      items: items.map(({ thread, authorName, replyCount }) => ({
        id: thread.id,
        title: thread.title,
        authorName,
        createdAt: thread.createdAt,
        lastActivityAt: thread.lastActivityAt,
        replyCount,
        locked: thread.lockedAt !== null,
        hasBestAnswer: thread.bestReplyId !== null,
        mine: thread.authorId === input.viewerId,
      })),
      total,
      page,
      pageCount,
    };
  }
}

export interface ForumThreadView {
  category: { slug: string; name: string };
  thread: ForumThreadResult;
  replies: ForumReplyResult[];
}

export class GetForumThreadUseCase {
  constructor(
    private readonly categories: ForumCategoryRepository,
    private readonly posts: ForumPostRepository,
  ) {}

  async execute(input: { threadId: string; viewerId: string }): Promise<ForumThreadView> {
    const row = await visibleThread(this.posts, input.threadId);
    const [category, replies] = await Promise.all([this.categories.findById(row.thread.categoryId), this.posts.listReplies(row.thread.id)]);

    if (!category) {
      throw new NotFoundError(THREAD_NOT_FOUND);
    }

    return {
      category: { slug: category.slug, name: category.name },
      thread: toThreadResult(row, input.viewerId),
      replies: replies.map((reply) => toReplyResult(reply, input.viewerId, row.thread.bestReplyId)),
    };
  }
}

export class CreateForumThreadUseCase {
  constructor(
    private readonly members: ForumMemberRepository,
    private readonly categories: ForumCategoryRepository,
    private readonly posts: ForumPostRepository,
    private readonly throttle: PostingThrottle,
    private readonly now: Clock = () => new Date(),
    private readonly newId: IdGenerator = () => crypto.randomUUID(),
  ) {}

  async execute(input: { memberId: string; categorySlug: string; title: string; body: string }): Promise<ForumThreadResult> {
    const member = await activeMember(this.members, input.memberId);
    const title = parseThreadTitle(input.title);
    const body = parseThreadBody(input.body);
    const category = await this.categories.findBySlug(input.categorySlug);

    if (!category) {
      throw new NotFoundError("Forum category not found");
    }

    await this.throttle.assertAllowed(member.id);

    const at = this.now();
    const thread: ForumThread = {
      id: this.newId(),
      categoryId: category.id,
      authorId: member.id,
      title,
      body,
      createdAt: at,
      updatedAt: at,
      editedAt: null,
      lastActivityAt: at,
      lockedAt: null,
      hiddenAt: null,
      bestReplyId: null,
    };

    await this.posts.create(thread);

    return toThreadResult({ thread, authorName: member.displayName, replyCount: 0 }, member.id);
  }
}

export class ReplyToForumThreadUseCase {
  constructor(
    private readonly members: ForumMemberRepository,
    private readonly posts: ForumPostRepository,
    private readonly throttle: PostingThrottle,
    private readonly now: Clock = () => new Date(),
    private readonly newId: IdGenerator = () => crypto.randomUUID(),
  ) {}

  async execute(input: { memberId: string; threadId: string; body: string }): Promise<ForumReplyResult> {
    const member = await activeMember(this.members, input.memberId);
    const body = parseReplyBody(input.body);
    const { thread } = await visibleThread(this.posts, input.threadId);

    assertThreadAcceptsReplies(thread);
    await this.throttle.assertAllowed(member.id);

    const at = this.now();
    const reply: ForumReply = { id: this.newId(), threadId: thread.id, authorId: member.id, body, createdAt: at, updatedAt: at, editedAt: null, hiddenAt: null };
    const outcome = await this.posts.addReply(reply);

    // The write re-checks under the thread's row lock: a lock or a hide that landed after the read above wins.
    if (outcome === "locked") {
      throw new ForumThreadLockedError();
    }

    if (outcome === "not-found") {
      throw new NotFoundError(THREAD_NOT_FOUND);
    }

    return toReplyResult({ reply, authorName: member.displayName }, member.id, null);
  }
}

export class EditForumThreadUseCase {
  constructor(
    private readonly members: ForumMemberRepository,
    private readonly posts: ForumPostRepository,
    private readonly now: Clock = () => new Date(),
  ) {}

  async execute(input: { memberId: string; threadId: string; title: string; body: string }): Promise<ForumThreadResult> {
    const member = await activeMember(this.members, input.memberId);
    const row = await this.posts.findThread(input.threadId);

    if (!row) {
      throw new NotFoundError(THREAD_NOT_FOUND);
    }

    assertCanEditPost(row.thread, member.id);

    const title = parseThreadTitle(input.title);
    const body = parseThreadBody(input.body);
    const at = this.now();

    await this.posts.updateThread(row.thread.id, { title, body, at });

    return toThreadResult({ ...row, thread: { ...row.thread, title, body, editedAt: at, updatedAt: at } }, member.id);
  }
}

export class EditForumReplyUseCase {
  constructor(
    private readonly members: ForumMemberRepository,
    private readonly posts: ForumPostRepository,
    private readonly now: Clock = () => new Date(),
  ) {}

  async execute(input: { memberId: string; replyId: string; body: string }): Promise<ForumReplyResult> {
    const member = await activeMember(this.members, input.memberId);
    const reply = await this.posts.findReply(input.replyId);

    if (!reply) {
      throw new NotFoundError("Forum reply not found");
    }

    assertCanEditPost(reply, member.id);
    await visibleThread(this.posts, reply.threadId);

    const body = parseReplyBody(input.body);
    const at = this.now();

    await this.posts.updateReply(reply.id, { body, at });

    return toReplyResult({ reply: { ...reply, body, editedAt: at, updatedAt: at }, authorName: member.displayName }, member.id, null);
  }
}

