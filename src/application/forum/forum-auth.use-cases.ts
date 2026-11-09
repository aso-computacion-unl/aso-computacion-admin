import { parseDisplayName, type ForumMember } from "@/domain/forum";
import { emailDomain, normalizeEmail } from "@/domain/user";
import { ValidationError } from "@/domain/domain-error";

import type { ForumMemberRepository, ForumSessionRepository } from "../ports/forum.ports";

/** Matches the forum cookie's lifetime (7 days). */
export const FORUM_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const FORUM_USER_AGENT_MAX_LENGTH = 200;
/** `lastSeenAt` is rewritten at most this often, so a page full of requests is not a page full of writes. */
const TOUCH_INTERVAL_MS = 60 * 1000;

type Clock = () => Date;
type IdGenerator = () => string;

export interface ForumLoginConfig {
  /** The institutional domain. Unset or blank disables the forum login altogether (fail closed). */
  allowedDomain?: string;
}

/** Why a login was refused. For logs only: the student always sees the same generic message. */
export type ForumLoginDenial = "disabled" | "unverified" | "domain" | "no-subject" | "identity-conflict" | "suspended";

export type ForumLoginOutcome = { ok: true; member: ForumMember } | { ok: false; reason: ForumLoginDenial };

export interface ForumGoogleIdentity {
  email: string;
  emailVerified: boolean;
  /** Google's stable account id (`sub`). */
  subject?: string;
  name?: string;
  /** Google's `hd` claim: the Workspace domain of the account. Absent for a personal account. */
  hostedDomain?: string;
}

export class ResolveForumLoginUseCase {
  private readonly allowedDomain: string | undefined;

  constructor(
    private readonly members: ForumMemberRepository,
    config: ForumLoginConfig,
    private readonly now: Clock = () => new Date(),
    private readonly newId: IdGenerator = () => crypto.randomUUID(),
  ) {
    this.allowedDomain = config.allowedDomain?.trim().replace(/^@/, "").toLowerCase() || undefined;
  }

  async execute(input: ForumGoogleIdentity): Promise<ForumLoginOutcome> {
    if (!this.allowedDomain) {
      return { ok: false, reason: "disabled" };
    }

    if (!input.emailVerified) {
      return { ok: false, reason: "unverified" };
    }

    const email = this.institutionalEmail(input);

    if (email === null) {
      return { ok: false, reason: "domain" };
    }

    if (!input.subject) {
      return { ok: false, reason: "no-subject" };
    }

    const known = await this.members.findByGoogleSub(input.subject);
    // An email that already belongs to a different Google identity is never handed over to a newcomer.
    const member = known ?? (await this.signUp(email, input.subject, input.name));

    if (member === "conflict" || member === null) {
      return { ok: false, reason: "identity-conflict" };
    }

    if (member.status !== "ACTIVE") {
      return { ok: false, reason: "suspended" };
    }

    await this.members.recordLogin(member.id, this.now());

    return { ok: true, member: { ...member, lastLoginAt: this.now() } };
  }

  /** The normalised email when it and the verified `hd` claim both name the domain; a personal account carries no `hd`. */
  private institutionalEmail(input: ForumGoogleIdentity): string | null {
    try {
      const email = normalizeEmail(input.email);

      return emailDomain(email) === this.allowedDomain && input.hostedDomain?.trim().toLowerCase() === this.allowedDomain ? email : null;
    } catch (error) {
      if (error instanceof ValidationError) {
        return null;
      }

      throw error;
    }
  }

  /** First login: the member is created on the spot. "conflict" when the email is taken by another Google identity. */
  private async signUp(email: string, subject: string, name: string | undefined): Promise<ForumMember | "conflict" | null> {
    if (await this.members.findByEmail(email)) {
      return "conflict";
    }

    const id = this.newId();
    const member: ForumMember = {
      id,
      email,
      googleSub: subject,
      displayName: parseDisplayName(name, id),
      status: "ACTIVE",
      suspendedAt: null,
      createdAt: this.now(),
      lastLoginAt: null,
    };

    // Two first logins at once: the unique indexes let one create, the other reads what it created.
    return (await this.members.create(member)) ? member : this.members.findByGoogleSub(subject);
  }
}

/** Who is acting in the forum, as resolved by the guard from the session row (never from the cookie's claims). */
export interface ForumActor {
  memberId: string;
  sessionId: string;
  /** The public name: the only thing about the member other students see. */
  displayName: string;
}

export class OpenForumSessionUseCase {
  constructor(
    private readonly sessions: ForumSessionRepository,
    private readonly now: Clock = () => new Date(),
    private readonly newId: IdGenerator = () => crypto.randomUUID(),
  ) {}

  async execute(input: { memberId: string; userAgent?: string | null; ipHash?: string | null; replaces?: string }): Promise<{ sessionId: string; expiresAt: Date }> {
    const at = this.now();
    const sessionId = this.newId();
    const expiresAt = new Date(at.getTime() + FORUM_SESSION_TTL_MS);

    if (input.replaces) {
      await this.sessions.revoke(input.replaces, at);
    }

    await this.sessions.create({
      id: sessionId,
      memberId: input.memberId,
      createdAt: at,
      expiresAt,
      revokedAt: null,
      lastSeenAt: at,
      userAgent: input.userAgent ? input.userAgent.slice(0, FORUM_USER_AGENT_MAX_LENGTH) : null,
      ipHash: input.ipHash ?? null,
    });

    return { sessionId, expiresAt };
  }
}

/** The guard's check, on every forum request: the cookie only names the session; the database decides. */
export class ValidateForumSessionUseCase {
  constructor(
    private readonly sessions: ForumSessionRepository,
    private readonly now: Clock = () => new Date(),
  ) {}

  async execute(input: { sessionId: string; memberId: string }): Promise<ForumActor | null> {
    const at = this.now();
    const found = await this.sessions.findWithMember(input.sessionId);

    if (!found || found.session.memberId !== input.memberId || found.session.revokedAt || found.session.expiresAt <= at || found.member.status !== "ACTIVE") {
      return null;
    }

    if (at.getTime() - found.session.lastSeenAt.getTime() >= TOUCH_INTERVAL_MS) {
      await this.sessions.touch(found.session.id, at);
    }

    return { memberId: found.member.id, sessionId: found.session.id, displayName: found.member.displayName };
  }
}

/**
 * Whether a session names a member the moderation suspended: all the landing asks, to say so instead of the
 * sign-in. It is not the guard: it opens nothing and returns nothing about the member, and it is false for any
 * session that does not exist or does not belong to the member the cookie claims. A revoked session counts
 * too, because suspending a member closes their sessions.
 */
export class CheckForumSuspensionUseCase {
  constructor(private readonly sessions: ForumSessionRepository) {}

  async execute(input: { sessionId: string; memberId: string }): Promise<boolean> {
    const found = await this.sessions.findWithMember(input.sessionId);

    return found !== null && found.session.memberId === input.memberId && found.member.status === "SUSPENDED";
  }
}

export class CloseForumSessionUseCase {
  constructor(
    private readonly sessions: ForumSessionRepository,
    private readonly now: Clock = () => new Date(),
  ) {}

  async execute(input: { sessionId: string }): Promise<void> {
    await this.sessions.revoke(input.sessionId, this.now());
  }
}
