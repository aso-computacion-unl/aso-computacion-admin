import type {
  ForumAddReplyOutcome,
  ForumBestAnswerOutcome,
  ForumCategoryDeleteOutcome,
  ForumCategoryRepository,
  ForumCategoryWithCount,
  ForumEditOutcome,
  ForumMemberRepository,
  ForumPostRepository,
  ForumReplyRow,
  ForumSessionRecord,
  ForumSessionRepository,
  ForumThreadRow,
  ForumThreadState,
} from "@/application/ports/forum.ports";
import type { ForumReactionRepository, ForumThreadReactions } from "@/application/ports/forum-reactions.ports";
import type {
  ForumModerationRepository,
  ForumModerationChange,
  ForumModerationStamp,
  ForumPostTarget,
  ForumReportQueue,
  ForumReportRow,
} from "@/application/ports/forum-moderation.ports";
import type { ForumMemberCriteria, ForumMemberDirectory } from "@/application/forum/forum-members.use-cases";
import { NotFoundError } from "@/application/use-cases/use-case-error";
import type { ForumCategory, ForumMember, ForumReply, ForumReport, ForumThread } from "@/domain/forum";

export function makeForumMember(overrides: Partial<ForumMember> = {}): ForumMember {
  return {
    id: "member-1",
    email: "ana@unl.edu.ec",
    googleSub: "sub-ana",
    displayName: "Ana",
    status: "ACTIVE",
    suspendedAt: null,
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
    lastLoginAt: null,
    ...overrides,
  };
}

export function makeForumCategory(overrides: Partial<ForumCategory> = {}): ForumCategory {
  return {
    id: "cat-1",
    slug: "programacion",
    name: "Programación",
    description: null,
    sortOrder: 1,
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
    updatedAt: new Date("2026-10-01T00:00:00.000Z"),
    ...overrides,
  };
}

export function makeForumThread(overrides: Partial<ForumThread> = {}): ForumThread {
  const at = new Date("2026-10-02T00:00:00.000Z");

  return {
    id: "thread-1",
    categoryId: "cat-1",
    authorId: "member-1",
    title: "Duda",
    body: "Cuerpo",
    createdAt: at,
    updatedAt: at,
    editedAt: null,
    lastActivityAt: at,
    lockedAt: null,
    hiddenAt: null,
    bestReplyId: null,
    ...overrides,
  };
}

export function makeForumReply(overrides: Partial<ForumReply> = {}): ForumReply {
  const at = new Date("2026-10-03T00:00:00.000Z");

  return { id: "reply-1", threadId: "thread-1", authorId: "member-1", body: "Respuesta", createdAt: at, updatedAt: at, editedAt: null, hiddenAt: null, ...overrides };
}

export function makeForumReport(overrides: Partial<ForumReport> = {}): ForumReport {
  return {
    id: "report-1",
    reporterId: "member-2",
    threadId: "thread-1",
    replyId: null,
    reason: "Spam",
    status: "OPEN",
    createdAt: new Date("2026-10-04T00:00:00.000Z"),
    resolvedAt: null,
    resolvedBy: null,
    resolutionNote: null,
    ...overrides,
  };
}

export class InMemoryForumMemberRepository implements ForumMemberRepository, ForumMemberDirectory {
  readonly members = new Map<string, ForumMember>();

  constructor(initial: ForumMember[] = []) {
    for (const member of initial) this.members.set(member.id, member);
  }

  async findById(id: string) {
    return this.members.get(id) ?? null;
  }

  async findByGoogleSub(sub: string) {
    return [...this.members.values()].find((member) => member.googleSub === sub) ?? null;
  }

  async findByEmail(email: string) {
    return [...this.members.values()].find((member) => member.email === email) ?? null;
  }

  async create(member: ForumMember) {
    if ((await this.findByEmail(member.email)) || (await this.findByGoogleSub(member.googleSub))) return false;
    this.members.set(member.id, member);
    return true;
  }

  async recordLogin(id: string, at: Date) {
    const member = this.members.get(id);
    if (member) this.members.set(id, { ...member, lastLoginAt: at });
  }

  async list({ filter, search }: ForumMemberCriteria, page: { offset: number; limit: number }) {
    const text = search.toLowerCase();
    const wanted = [...this.members.values()]
      .filter((member) => filter === "all" || member.status === "SUSPENDED")
      .filter((member) => text === "" || member.displayName.toLowerCase().includes(text) || member.email.toLowerCase().includes(text))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || a.id.localeCompare(b.id));

    return { items: wanted.slice(page.offset, page.offset + page.limit), total: wanted.length };
  }
}

export class InMemoryForumSessionRepository implements ForumSessionRepository {
  readonly sessions = new Map<string, ForumSessionRecord>();
  touched: string[] = [];

  constructor(private readonly members: InMemoryForumMemberRepository) {}

  async create(session: ForumSessionRecord) {
    this.sessions.set(session.id, session);
  }

  async findWithMember(id: string) {
    const session = this.sessions.get(id);
    const member = session ? await this.members.findById(session.memberId) : null;

    return session && member ? { session, member } : null;
  }

  async touch(id: string, at: Date) {
    const session = this.sessions.get(id);
    if (session) this.sessions.set(id, { ...session, lastSeenAt: at });
    this.touched.push(id);
  }

  async revoke(id: string, at: Date) {
    const session = this.sessions.get(id);
    if (!session || session.revokedAt) return false;
    this.sessions.set(id, { ...session, revokedAt: at });
    return true;
  }
}

/** Categories, threads, replies and reports share one store, like the tables they stand for. */
export class InMemoryForumStore {
  readonly categories = new Map<string, ForumCategory>();
  readonly threads = new Map<string, ForumThread>();
  readonly replies = new Map<string, ForumReply>();
  readonly reports = new Map<string, ForumReport>();
  /** One entry per «me sirvió»: the member and the post it is on. */
  readonly reactions = new Map<string, { memberId: string; threadId: string | null; replyId: string | null }>();

  constructor(readonly members: InMemoryForumMemberRepository) {}
}

export class InMemoryForumCategoryRepository implements ForumCategoryRepository {
  constructor(private readonly store: InMemoryForumStore) {}

  async list(): Promise<ForumCategoryWithCount[]> {
    return [...this.store.categories.values()]
      .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.getTime() - b.createdAt.getTime())
      .map((category) => ({
        category,
        threadCount: [...this.store.threads.values()].filter((thread) => thread.categoryId === category.id && !thread.hiddenAt).length,
      }));
  }

  async findById(id: string) {
    return this.store.categories.get(id) ?? null;
  }

  async findBySlug(slug: string) {
    return [...this.store.categories.values()].find((category) => category.slug === slug) ?? null;
  }

  async nextSortOrder() {
    return Math.max(0, ...[...this.store.categories.values()].map((category) => category.sortOrder)) + 1;
  }

  async create(category: ForumCategory) {
    if (await this.findBySlug(category.slug)) return false;
    this.store.categories.set(category.id, category);
    return true;
  }

  async update(category: ForumCategory) {
    if (!this.store.categories.has(category.id)) throw new NotFoundError("Forum category not found");
    const other = await this.findBySlug(category.slug);
    if (other && other.id !== category.id) return false;
    this.store.categories.set(category.id, category);
    return true;
  }

  async delete(id: string): Promise<ForumCategoryDeleteOutcome> {
    if (!this.store.categories.has(id)) return "not-found";
    if ([...this.store.threads.values()].some((thread) => thread.categoryId === id)) return "not-empty";
    this.store.categories.delete(id);
    return "ok";
  }
}

export class InMemoryForumPostRepository implements ForumPostRepository {
  constructor(private readonly store: InMemoryForumStore) {}

  private async nameOf(memberId: string) {
    return (await this.store.members.findById(memberId))?.displayName ?? "";
  }

  private row(thread: ForumThread, authorName: string): ForumThreadRow {
    const replyCount = [...this.store.replies.values()].filter((reply) => reply.threadId === thread.id && !reply.hiddenAt).length;

    return { thread, authorName, replyCount };
  }

  async create(thread: ForumThread) {
    this.store.threads.set(thread.id, thread);
  }

  async findThread(id: string) {
    const thread = this.store.threads.get(id);

    return thread ? this.row(thread, await this.nameOf(thread.authorId)) : null;
  }

  async listThreads(categoryId: string, page: { offset: number; limit: number }) {
    const visible = [...this.store.threads.values()]
      .filter((thread) => thread.categoryId === categoryId && !thread.hiddenAt)
      .sort((a, b) => b.lastActivityAt.getTime() - a.lastActivityAt.getTime());
    const items = await Promise.all(visible.slice(page.offset, page.offset + page.limit).map(async (thread) => this.row(thread, await this.nameOf(thread.authorId))));

    return { items, total: visible.length };
  }

  async listFeed(scope: { categoryId?: string; state: ForumThreadState }, page: { offset: number; limit: number }) {
    const inScope = [...this.store.threads.values()].filter((thread) => !thread.hiddenAt && (scope.categoryId === undefined || thread.categoryId === scope.categoryId));
    const solved = inScope.filter((thread) => thread.bestReplyId !== null);
    const open = inScope.filter((thread) => thread.bestReplyId === null);
    const listed = (scope.state === "solved" ? solved : open).sort((a, b) => b.lastActivityAt.getTime() - a.lastActivityAt.getTime());
    const items = await Promise.all(listed.slice(page.offset, page.offset + page.limit).map(async (thread) => this.row(thread, await this.nameOf(thread.authorId))));

    return { items, counts: { open: open.length, solved: solved.length } };
  }

  async updateThread(id: string, change: { title: string; body: string; at: Date; authorId: string }): Promise<ForumEditOutcome> {
    const thread = this.store.threads.get(id);

    if (!thread || thread.hiddenAt || thread.authorId !== change.authorId) return "not-found";
    if (thread.lockedAt) return "locked";

    this.store.threads.set(id, { ...thread, title: change.title, body: change.body, editedAt: change.at, updatedAt: change.at });

    return "ok";
  }

  async addReply(reply: ForumReply): Promise<ForumAddReplyOutcome> {
    const thread = this.store.threads.get(reply.threadId);

    if (!thread || thread.hiddenAt) return "not-found";
    if (thread.lockedAt) return "locked";

    this.store.replies.set(reply.id, reply);
    this.store.threads.set(thread.id, { ...thread, lastActivityAt: reply.createdAt });

    return "ok";
  }

  async setBestReply(threadId: string, replyId: string | null): Promise<ForumBestAnswerOutcome> {
    const thread = this.store.threads.get(threadId);

    if (!thread || thread.hiddenAt) return "not-found";
    if (thread.lockedAt) return "locked";

    const reply = replyId === null ? null : this.store.replies.get(replyId);

    if (replyId !== null && (!reply || reply.threadId !== threadId || reply.hiddenAt)) return "invalid-reply";

    this.store.threads.set(threadId, { ...thread, bestReplyId: replyId });

    return "ok";
  }

  async listReplies(threadId: string): Promise<ForumReplyRow[]> {
    const replies = [...this.store.replies.values()]
      .filter((reply) => reply.threadId === threadId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    return Promise.all(replies.map(async (reply) => ({ reply, authorName: await this.nameOf(reply.authorId) })));
  }

  async findReply(id: string) {
    return this.store.replies.get(id) ?? null;
  }

  async updateReply(id: string, change: { body: string; at: Date; authorId: string }): Promise<ForumEditOutcome> {
    const reply = this.store.replies.get(id);
    const thread = reply && this.store.threads.get(reply.threadId);

    if (!reply || !thread || reply.hiddenAt || thread.hiddenAt || reply.authorId !== change.authorId) return "not-found";
    if (thread.lockedAt) return "locked";

    this.store.replies.set(id, { ...reply, body: change.body, editedAt: change.at, updatedAt: change.at });
    if (thread.bestReplyId === id) this.store.threads.set(thread.id, { ...thread, bestReplyId: null });

    return "ok";
  }

  async countPostsSince(memberId: string, since: Date) {
    const threads = [...this.store.threads.values()].filter((thread) => thread.authorId === memberId && thread.createdAt >= since);
    const replies = [...this.store.replies.values()].filter((reply) => reply.authorId === memberId && reply.createdAt >= since);

    return threads.length + replies.length;
  }

  async oldestPostSince(memberId: string, since: Date) {
    const times = [...this.store.threads.values(), ...this.store.replies.values()].filter((post) => post.authorId === memberId && post.createdAt >= since).map((post) => post.createdAt.getTime());

    return times.length === 0 ? null : new Date(Math.min(...times));
  }
}

/** Keeps the rule the partial unique indexes keep: one OPEN report per reporter per target. */
export class InMemoryForumModerationRepository implements ForumModerationRepository {
  constructor(
    private readonly store: InMemoryForumStore,
    private readonly sessions: InMemoryForumSessionRepository,
  ) {}

  async createReport(report: ForumReport) {
    const duplicate = [...this.store.reports.values()].some(
      (other) => other.status === "OPEN" && other.reporterId === report.reporterId && other.threadId === report.threadId && other.replyId === report.replyId,
    );

    if (duplicate) return false;
    this.store.reports.set(report.id, report);
    return true;
  }

  private row(report: ForumReport): ForumReportRow | null {
    const reply = report.replyId ? this.store.replies.get(report.replyId) : undefined;
    const thread = this.store.threads.get(report.threadId ?? reply?.threadId ?? "");
    const post = reply ?? thread;
    const author = post && this.store.members.members.get(post.authorId);
    const reporter = this.store.members.members.get(report.reporterId);

    if (!thread || !post || !author || !reporter) return null;

    return {
      report,
      reporterName: reporter.displayName,
      post: {
        kind: reply ? "reply" : "thread",
        threadId: thread.id,
        threadTitle: thread.title,
        body: post.body,
        authorId: author.id,
        authorName: author.displayName,
        authorSuspended: author.status === "SUSPENDED",
        hidden: post.hiddenAt !== null,
        locked: thread.lockedAt !== null,
      },
    };
  }

  async listReports(queue: ForumReportQueue, page: { offset: number; limit: number }) {
    const wanted = [...this.store.reports.values()]
      .filter((report) => (queue === "open") === (report.status === "OPEN"))
      .sort((a, b) => (queue === "open" ? a.createdAt.getTime() - b.createdAt.getTime() : (b.resolvedAt?.getTime() ?? 0) - (a.resolvedAt?.getTime() ?? 0) || b.createdAt.getTime() - a.createdAt.getTime()));
    const rows = wanted.map((report) => this.row(report)).filter((row): row is ForumReportRow => row !== null);

    return { items: rows.slice(page.offset, page.offset + page.limit), total: rows.length };
  }

  async closeReport(id: string, change: ForumModerationStamp & { status: "RESOLVED" | "DISMISSED"; note: string | null }) {
    const report = this.store.reports.get(id);

    if (!report) return "not-found";
    if (report.status !== "OPEN") return "closed";

    this.store.reports.set(id, { ...report, status: change.status, resolvedAt: change.at, resolvedBy: change.by, resolutionNote: change.note });

    return "ok";
  }

  async setPostHidden(target: ForumPostTarget, hidden: boolean, stamp: ForumModerationStamp): Promise<ForumModerationChange> {
    if (target.kind === "thread") {
      const thread = this.store.threads.get(target.id);

      if (!thread) return "not-found";
      if ((thread.hiddenAt !== null) === hidden) return "unchanged";
      this.store.threads.set(thread.id, { ...thread, hiddenAt: hidden ? stamp.at : null });

      return "changed";
    }

    const reply = this.store.replies.get(target.id);

    if (!reply) return "not-found";
    if ((reply.hiddenAt !== null) === hidden) return "unchanged";
    this.store.replies.set(reply.id, { ...reply, hiddenAt: hidden ? stamp.at : null });

    const thread = this.store.threads.get(reply.threadId);
    if (hidden && thread?.bestReplyId === reply.id) this.store.threads.set(thread.id, { ...thread, bestReplyId: null });

    return "changed";
  }

  async setThreadLocked(threadId: string, locked: boolean, stamp: ForumModerationStamp): Promise<ForumModerationChange> {
    const thread = this.store.threads.get(threadId);

    if (!thread) return "not-found";
    if ((thread.lockedAt !== null) === locked) return "unchanged";
    this.store.threads.set(threadId, { ...thread, lockedAt: locked ? stamp.at : null });

    return "changed";
  }

  async setMemberSuspended(memberId: string, suspended: boolean, stamp: ForumModerationStamp): Promise<ForumModerationChange> {
    const member = this.store.members.members.get(memberId);

    if (!member) return "not-found";

    const changed = (member.status === "SUSPENDED") !== suspended;

    if (changed) {
      this.store.members.members.set(memberId, suspended ? { ...member, status: "SUSPENDED", suspendedAt: stamp.at } : { ...member, status: "ACTIVE", suspendedAt: null });
    }

    if (suspended) {
      for (const session of this.sessions.sessions.values()) {
        if (session.memberId === memberId && !session.revokedAt) this.sessions.sessions.set(session.id, { ...session, revokedAt: stamp.at });
      }
    }

    return changed ? "changed" : "unchanged";
  }
}

export class InMemoryForumReactionRepository implements ForumReactionRepository {
  constructor(private readonly store: InMemoryForumStore) {}

  private onTarget(target: ForumPostTarget) {
    return [...this.store.reactions.entries()].filter(([, reaction]) => (target.kind === "thread" ? reaction.threadId === target.id : reaction.replyId === target.id));
  }

  async toggle(memberId: string, target: ForumPostTarget, reaction: { id: string; at: Date }) {
    const mine = this.onTarget(target).find(([, other]) => other.memberId === memberId);

    if (mine) {
      this.store.reactions.delete(mine[0]);
    } else {
      this.store.reactions.set(reaction.id, { memberId, threadId: target.kind === "thread" ? target.id : null, replyId: target.kind === "reply" ? target.id : null });
    }

    return { reacted: !mine, count: this.onTarget(target).length };
  }

  async summarize(threadId: string, viewerId: string): Promise<ForumThreadReactions> {
    const summary = (target: ForumPostTarget) => {
      const reactions = this.onTarget(target);

      return { count: reactions.length, mine: reactions.some(([, reaction]) => reaction.memberId === viewerId) };
    };
    const replies: ForumThreadReactions["replies"] = {};

    for (const reply of this.store.replies.values()) {
      const entry = summary({ kind: "reply", id: reply.id });

      if (reply.threadId === threadId && !reply.hiddenAt && entry.count > 0) replies[reply.id] = entry;
    }

    return { thread: summary({ kind: "thread", id: threadId }), replies };
  }
}
