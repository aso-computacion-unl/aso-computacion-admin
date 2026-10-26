import type { AdminInvite } from "@/domain/admin-invite";
import type { Role, SessionKind, User } from "@/domain/user";

export interface SessionRecord {
  id: string;
  kind: SessionKind;
  userId: string | null;
  createdAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  lastSeenAt: Date;
  userAgent: string | null;
  /** Salted hash, never the address. */
  ipHash: string | null;
}

export interface SessionWithUser {
  session: SessionRecord;
  user: User | null;
}

/** One row of "Sesiones activas". */
export interface ActiveSessionView {
  id: string;
  kind: SessionKind;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  createdAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
  userAgent: string | null;
}

export type SessionScope = { userId: string } | "all";

export interface SessionRepository {
  create(session: SessionRecord): Promise<void>;
  findWithUser(id: string): Promise<SessionWithUser | null>;
  touch(id: string, at: Date): Promise<void>;
  /** True when the session was active and is now revoked. */
  revoke(id: string, at: Date): Promise<boolean>;
  revokeAllForUser(userId: string, at: Date): Promise<number>;
  /**
   * Not revoked and not expired at `now`, newest first. The scope is always explicit: one user's
   * sessions, or `"all"` (only for a caller that already passed an admin check). An empty user id
   * matches nothing.
   */
  listActive(now: Date, scope: SessionScope): Promise<ActiveSessionView[]>;
}

export type UserChangeOutcome = "ok" | "not-found" | "last-admin";

export interface UserRepository {
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  list(): Promise<User[]>;
  /** False when the email is already taken (decided by the unique index, not a read). */
  create(user: User): Promise<boolean>;
  /**
   * Changes the role and/or the active flag. Atomic with the last-admin rule: it refuses with
   * "last-admin", and changes nothing, when the change would leave no active ADMIN.
   */
  applyChange(id: string, change: { role?: Role; active?: boolean }): Promise<UserChangeOutcome>;
  recordLogin(id: string, at: Date): Promise<void>;
}

/** An invite as stored: the SHA-256 of the link's token, never the token itself. */
export interface AdminInviteRecord extends AdminInvite {
  tokenHash: string;
}

export type InviteRedemption = "ok" | "unavailable" | "email-taken";

export interface AdminInviteRepository {
  /** Stores the invite and, in the same transaction, revokes the other pending invites of its email: one live link per person. */
  create(invite: AdminInviteRecord): Promise<void>;
  findByTokenHash(tokenHash: string): Promise<AdminInvite | null>;
  /** Not used, not revoked and not expired at `now`, newest first. */
  listPending(now: Date): Promise<AdminInvite[]>;
  /** True when the invite was pending at `at` and is now revoked. */
  revoke(id: string, at: Date): Promise<boolean>;
  /**
   * Marks the invite used by `user` and creates `user`, atomically: two redemptions of one link
   * cannot both win. "unavailable" when the invite is no longer pending at `user.createdAt` or is
   * bound to another email; "email-taken" when a user with that email exists. Both change nothing.
   */
  redeem(inviteId: string, user: User): Promise<InviteRedemption>;
}

export type AuditActorKind = SessionKind | "system";

export interface AuditEntryInput {
  actorUserId: string | null;
  actorKind: AuditActorKind;
  /** Dotted verb, e.g. `event.create`. */
  action: string;
  entityType: string;
  entityId?: string | null;
  /** Short, human readable, no content bodies and no secrets. */
  summary: string;
}

/** The single way anything writes to the audit log. */
export interface AuditRecorder {
  record(entry: AuditEntryInput): Promise<void>;
}

export interface AuditEntry extends AuditEntryInput {
  id: string;
  at: Date;
  entityId: string | null;
}

export interface AuditListCriteria {
  entityType?: string;
  /** A user id, or "break_glass" / "system". */
  actor?: string;
  page: number;
  pageSize: number;
}

export interface AuditLogReader {
  list(criteria: AuditListCriteria): Promise<{ items: AuditEntry[]; total: number }>;
  /** Entity types present in the log, for the filter. */
  entityTypes(): Promise<string[]>;
}
