import type { PrismaClient } from "@/generated/prisma/client";
import type { Cookie } from "@playwright/test";
import { SignJWT } from "jose";

/*
 * A signed-in forum member without a real Google account: the member and its session row go straight into the
 * database, and the `forum-session` token is signed the way the app signs it (same claims as
 * src/infrastructure/forum/forum-session-jwt.ts), so the app has to know the signing secret:
 *
 *   FORUM_SESSION_SECRET=<at least 32 characters> npm run e2e
 *
 * Specs that need a member call `plantForumMemberSession` and hand `session.cookie` to `context.addCookies`.
 */
const COOKIE_NAME = "forum_sid";
const AUDIENCE = "aso-computacion-forum";
const SESSION_TYPE = "forum-session";
const DEFAULT_LIFETIME_SECONDS = 3600;

/** The secret the harness gave the app; empty when the signed-in suites are not enabled. */
export const FORUM_SESSION_SECRET = process.env.FORUM_SESSION_SECRET ?? "";

export interface ForumMemberSessionOptions {
  /** Member id; the session id and the e-mail derive from it unless given. */
  memberId: string;
  sessionId?: string;
  email?: string;
  displayName?: string;
  /** Plants a member the moderation already suspended: the guard refuses the session. */
  suspended?: boolean;
  /** How long the session (row and token) lasts; a negative value plants one that has already expired. */
  lifetimeSeconds?: number;
  /** Plants a session the member already signed out of. */
  revoked?: boolean;
  /** Cookie domain; the e2e server answers on 127.0.0.1. */
  domain?: string;
  secret?: string;
}

export interface PlantedForumMemberSession {
  memberId: string;
  sessionId: string;
  email: string;
  /** The signed `forum-session` token, the value of the cookie. */
  token: string;
  /** Ready for `context.addCookies([session.cookie])`. */
  cookie: Pick<Cookie, "name" | "value" | "domain" | "path">;
}

/** The signed token alone, for a spec that builds its own member rows. */
export async function signForumSessionToken({ memberId, sessionId, lifetimeSeconds = DEFAULT_LIFETIME_SECONDS, secret = FORUM_SESSION_SECRET }: { memberId: string; sessionId: string; lifetimeSeconds?: number; secret?: string }): Promise<string> {
  if (!secret) {
    throw new Error("set FORUM_SESSION_SECRET to plant a forum member session");
  }

  const issuedAt = Math.floor(Date.now() / 1000);

  return new SignJWT({ sid: sessionId, mid: memberId, typ: SESSION_TYPE })
    .setSubject(memberId)
    .setAudience(AUDIENCE)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + lifetimeSeconds)
    .sign(new TextEncoder().encode(secret));
}

/**
 * Creates (or resets, so a re-run starts clean) the member and its session and signs the cookie value.
 * The member's `googleSub` is `sub-<memberId>` and its default e-mail `<memberId>@unl.edu.ec`, a domain the harness allows.
 */
export async function plantForumMemberSession(prisma: PrismaClient, options: ForumMemberSessionOptions): Promise<PlantedForumMemberSession> {
  const { memberId, suspended = false, revoked = false, lifetimeSeconds = DEFAULT_LIFETIME_SECONDS, domain = "127.0.0.1", secret } = options;
  const sessionId = options.sessionId ?? `${memberId}-session`;
  const email = options.email ?? `${memberId}@unl.edu.ec`;
  const displayName = options.displayName ?? memberId;
  const now = new Date();
  const status = suspended ? ("SUSPENDED" as const) : ("ACTIVE" as const);
  const suspendedAt = suspended ? now : null;

  await prisma.forumMember.upsert({
    where: { id: memberId },
    update: { status, suspendedAt },
    create: { id: memberId, email, googleSub: `sub-${memberId}`, displayName, status, suspendedAt },
  });

  const expiresAt = new Date(now.getTime() + lifetimeSeconds * 1000);
  const revokedAt = revoked ? now : null;

  await prisma.forumSession.upsert({
    where: { id: sessionId },
    update: { expiresAt, revokedAt },
    create: { id: sessionId, memberId, expiresAt, revokedAt, lastSeenAt: now },
  });

  const token = await signForumSessionToken({ memberId, sessionId, lifetimeSeconds, secret });

  return { memberId, sessionId, email, token, cookie: { name: COOKIE_NAME, value: token, domain, path: "/" } };
}
