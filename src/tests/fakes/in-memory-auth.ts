import type {
  ActiveSessionView,
  AdminInviteRecord,
  AdminInviteRepository,
  AuditEntry,
  AuditEntryInput,
  AuditListCriteria,
  AuditLogReader,
  AuditRecorder,
  InviteRedemption,
  SessionRecord,
  SessionRepository,
  SessionScope,
  SessionWithUser,
  UserChangeOutcome,
  UserRepository,
} from "@/application/ports/auth.ports";
import type { AdminInvite } from "@/domain/admin-invite";
import type { Role, User } from "@/domain/user";

export function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: "user-1",
    email: "ana@example.org",
    name: "Ana",
    role: "EDITOR",
    active: true,
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
    lastLoginAt: null,
    ...overrides,
  };
}

export class InMemoryUserRepository implements UserRepository {
  readonly users = new Map<string, User>();

  constructor(initial: User[] = []) {
    for (const user of initial) this.users.set(user.id, user);
  }

  async findByEmail(email: string) {
    return [...this.users.values()].find((user) => user.email === email) ?? null;
  }

  async findById(id: string) {
    return this.users.get(id) ?? null;
  }

  async list() {
    return [...this.users.values()].sort((a, b) => a.email.localeCompare(b.email));
  }

  async create(user: User) {
    if (await this.findByEmail(user.email)) return false;
    this.users.set(user.id, user);
    return true;
  }

  async applyChange(id: string, change: { role?: Role; active?: boolean }): Promise<UserChangeOutcome> {
    const user = this.users.get(id);
    if (!user) return "not-found";

    const next = { ...user, ...change };
    const isActiveAdmin = (candidate: User) => candidate.role === "ADMIN" && candidate.active;
    const others = [...this.users.values()].filter((candidate) => candidate.id !== id && isActiveAdmin(candidate));

    if (isActiveAdmin(user) && !isActiveAdmin(next) && others.length === 0) return "last-admin";

    this.users.set(id, next);
    return "ok";
  }

  async recordLogin(id: string, at: Date) {
    const user = this.users.get(id);
    if (user) this.users.set(id, { ...user, lastLoginAt: at });
  }
}

export class InMemorySessionRepository implements SessionRepository {
  readonly sessions = new Map<string, SessionRecord>();
  touched: string[] = [];

  constructor(private readonly users: InMemoryUserRepository) {}

  async create(session: SessionRecord) {
    this.sessions.set(session.id, session);
  }

  async findWithUser(id: string): Promise<SessionWithUser | null> {
    const session = this.sessions.get(id);
    if (!session) return null;

    return { session, user: session.userId ? await this.users.findById(session.userId) : null };
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

  async revokeAllForUser(userId: string, at: Date) {
    let count = 0;
    for (const session of this.sessions.values()) {
      if (session.userId === userId && (await this.revoke(session.id, at))) count += 1;
    }
    return count;
  }

  async listActive(now: Date, scope: SessionScope): Promise<ActiveSessionView[]> {
    const views: ActiveSessionView[] = [];

    for (const session of this.sessions.values()) {
      if (session.revokedAt || session.expiresAt <= now) continue;
      if (scope !== "all" && session.userId !== scope.userId) continue;
      const user = session.userId ? await this.users.findById(session.userId) : null;
      views.push({
        id: session.id,
        kind: session.kind,
        userId: session.userId,
        userName: user?.name ?? null,
        userEmail: user?.email ?? null,
        createdAt: session.createdAt,
        lastSeenAt: session.lastSeenAt,
        expiresAt: session.expiresAt,
        userAgent: session.userAgent,
      });
    }

    return views.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
}

export class InMemoryAuditLog implements AuditRecorder, AuditLogReader {
  readonly entries: AuditEntry[] = [];
  failWith: Error | undefined;

  async record(entry: AuditEntryInput) {
    if (this.failWith) throw this.failWith;
    this.entries.unshift({ ...entry, entityId: entry.entityId ?? null, id: `audit-${this.entries.length + 1}`, at: new Date() });
  }

  async list(criteria: AuditListCriteria) {
    const matching = this.entries.filter(
      (entry) =>
        (!criteria.entityType || entry.entityType === criteria.entityType) &&
        (!criteria.actor || (entry.actorUserId ?? entry.actorKind) === criteria.actor),
    );
    const start = (criteria.page - 1) * criteria.pageSize;

    return { items: matching.slice(start, start + criteria.pageSize), total: matching.length };
  }

  async entityTypes() {
    return [...new Set(this.entries.map((entry) => entry.entityType))].sort();
  }
}

export function makeInvite(overrides: Partial<AdminInviteRecord> = {}): AdminInviteRecord {
  return {
    id: "invite-1",
    tokenHash: "a".repeat(64),
    email: "ben@example.org",
    role: "EDITOR",
    createdById: "root",
    createdAt: new Date("2026-10-26T12:00:00.000Z"),
    expiresAt: new Date("2026-11-02T12:00:00.000Z"),
    usedAt: null,
    usedByUserId: null,
    revokedAt: null,
    ...overrides,
  };
}

const isPending = (invite: AdminInviteRecord, now: Date) => !invite.usedAt && !invite.revokedAt && invite.expiresAt.getTime() > now.getTime();

function withoutHash(record: AdminInviteRecord): AdminInvite {
  const invite: Partial<AdminInviteRecord> & AdminInvite = { ...record };
  delete invite.tokenHash;
  return invite;
}

export class InMemoryAdminInviteRepository implements AdminInviteRepository {
  readonly invites = new Map<string, AdminInviteRecord>();

  constructor(private readonly users: InMemoryUserRepository) {}

  async create(invite: AdminInviteRecord) {
    const superseded: string[] = [];
    for (const other of this.invites.values()) {
      if (other.email === invite.email && isPending(other, invite.createdAt)) {
        this.invites.set(other.id, { ...other, revokedAt: invite.createdAt });
        superseded.push(other.id);
      }
    }
    this.invites.set(invite.id, invite);
    return superseded;
  }

  async findByTokenHash(tokenHash: string) {
    const invite = [...this.invites.values()].find((candidate) => candidate.tokenHash === tokenHash);
    return invite ? withoutHash(invite) : null;
  }

  async listPending(now: Date) {
    return [...this.invites.values()]
      .filter((invite) => isPending(invite, now))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map(withoutHash);
  }

  async revoke(id: string, at: Date) {
    const invite = this.invites.get(id);
    if (!invite || !isPending(invite, at)) return false;
    this.invites.set(id, { ...invite, revokedAt: at });
    return true;
  }

  async redeem(inviteId: string, user: User): Promise<InviteRedemption> {
    const invite = this.invites.get(inviteId);
    if (!invite || !isPending(invite, user.createdAt) || invite.email !== user.email) return "unavailable";
    if (!(await this.users.create(user))) return "email-taken";
    this.invites.set(inviteId, { ...invite, usedAt: user.createdAt, usedByUserId: user.id });
    return "ok";
  }
}
