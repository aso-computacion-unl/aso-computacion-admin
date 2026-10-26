import type {
  ForumAddReplyOutcome,
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
} from "@/application/ports/forum.ports";
import { NotFoundError } from "@/application/use-cases/use-case-error";
import type { ForumCategory, ForumMember, ForumReply, ForumThread } from "@/domain/forum";

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

export class InMemoryForumMemberRepository implements ForumMemberRepository {
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

/** Categories, threads and replies share one store, like the tables they stand for. */
export class InMemoryForumStore {
  readonly categories = new Map<string, ForumCategory>();
  readonly threads = new Map<string, ForumThread>();
  readonly replies = new Map<string, ForumReply>();

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

  async listReplies(threadId: string): Promise<ForumReplyRow[]> {
    const replies = [...this.store.replies.values()]
      .filter((reply) => reply.threadId === threadId && !reply.hiddenAt)
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
}
