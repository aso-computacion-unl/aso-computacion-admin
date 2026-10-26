import type { SessionRepository, UserRepository } from "../ports/auth.ports";
import { ForbiddenError, NotFoundError } from "../use-cases/use-case-error";
import type { Actor, SessionKind } from "@/domain/user";

/** Matches the session cookie's lifetime (24 h). */
export const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
export const USER_AGENT_MAX_LENGTH = 200;
/** `lastSeenAt` is rewritten at most this often, so a page full of actions is not a page full of writes. */
const TOUCH_INTERVAL_MS = 60 * 1000;

const BREAK_GLASS_NAME = "Acceso de emergencia";

type Clock = () => Date;
type IdGenerator = () => string;

export type SessionSubject = { kind: "user"; userId: string } | { kind: "break_glass" };

export interface StartSessionInput {
  subject: SessionSubject;
  userAgent?: string | null;
  /** Already hashed by the caller: this layer never sees an address. */
  ipHash?: string | null;
  /** The session the browser presented, revoked so a login never reuses an old session id. */
  replaces?: string;
}

export class StartSessionUseCase {
  constructor(
    private readonly sessions: SessionRepository,
    private readonly users: UserRepository,
    private readonly now: Clock = () => new Date(),
    private readonly newId: IdGenerator = () => crypto.randomUUID(),
  ) {}

  async execute(input: StartSessionInput): Promise<{ sessionId: string; expiresAt: Date }> {
    const at = this.now();
    const sessionId = this.newId();
    const expiresAt = new Date(at.getTime() + SESSION_TTL_MS);

    if (input.replaces) {
      await this.sessions.revoke(input.replaces, at);
    }

    await this.sessions.create({
      id: sessionId,
      kind: input.subject.kind,
      userId: input.subject.kind === "user" ? input.subject.userId : null,
      createdAt: at,
      expiresAt,
      revokedAt: null,
      lastSeenAt: at,
      userAgent: input.userAgent ? input.userAgent.slice(0, USER_AGENT_MAX_LENGTH) : null,
      ipHash: input.ipHash ?? null,
    });

    if (input.subject.kind === "user") {
      try {
        await this.users.recordLogin(input.subject.userId, at);
      } catch (error) {
        // The caller never learns this session id, so nothing could ever revoke it.
        await this.sessions.revoke(sessionId, at).catch(() => undefined);
        throw error;
      }
    }

    return { sessionId, expiresAt };
  }
}

export interface ValidateSessionInput {
  sessionId: string;
  /** The kind the signed cookie claims; it must match the row. */
  kind: SessionKind;
  /** Whether the emergency password login is currently on: off invalidates every break-glass session. */
  breakGlassEnabled: boolean;
}

/**
 * The guard's check, on every action and protected page. The cookie only says which
 * session it is; whether it is still good, and who may do what, comes from the database.
 */
export class ValidateSessionUseCase {
  constructor(
    private readonly sessions: SessionRepository,
    private readonly now: Clock = () => new Date(),
  ) {}

  async execute({ sessionId, kind, breakGlassEnabled }: ValidateSessionInput): Promise<Actor | null> {
    const at = this.now();
    const found = await this.sessions.findWithUser(sessionId);

    if (!found || found.session.kind !== kind || found.session.revokedAt || found.session.expiresAt <= at) {
      return null;
    }

    const actor = this.actorOf(found.session.id, kind, found.user, breakGlassEnabled);

    if (actor && at.getTime() - found.session.lastSeenAt.getTime() >= TOUCH_INTERVAL_MS) {
      try {
        await this.sessions.touch(found.session.id, at);
      } catch {
        // A missed `lastSeenAt` must never fail the request it rides on.
      }
    }

    return actor;
  }

  private actorOf(
    sessionId: string,
    kind: SessionKind,
    user: { id: string; name: string; role: Actor["role"]; active: boolean } | null,
    breakGlassEnabled: boolean,
  ): Actor | null {
    if (kind === "break_glass") {
      return breakGlassEnabled ? { kind, sessionId, userId: null, name: BREAK_GLASS_NAME, role: "ADMIN" } : null;
    }

    return user?.active ? { kind, sessionId, userId: user.id, name: user.name, role: user.role } : null;
  }
}

export class ListActiveSessionsUseCase {
  constructor(
    private readonly sessions: SessionRepository,
    private readonly now: Clock = () => new Date(),
  ) {}

  /** An admin sees every session; anyone else only their own (and nothing without a user id). */
  async execute({ actor }: { actor: Actor }) {
    if (actor.role === "ADMIN") {
      return this.sessions.listActive(this.now(), "all");
    }

    return actor.userId ? this.sessions.listActive(this.now(), { userId: actor.userId }) : [];
  }
}

export class RevokeSessionUseCase {
  constructor(
    private readonly sessions: SessionRepository,
    private readonly now: Clock = () => new Date(),
  ) {}

  async execute({ actor, sessionId }: { actor: Actor; sessionId: string }): Promise<void> {
    const found = await this.sessions.findWithUser(sessionId);

    if (!found || found.session.revokedAt) {
      throw new NotFoundError("Session not found");
    }

    const isOwn = actor.userId !== null && found.session.userId === actor.userId;

    if (!isOwn && actor.role !== "ADMIN") {
      throw new ForbiddenError();
    }

    await this.sessions.revoke(sessionId, this.now());
  }
}
