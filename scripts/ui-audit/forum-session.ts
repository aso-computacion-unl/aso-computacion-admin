import { randomUUID } from "node:crypto";

import type { PrismaClient } from "@/generated/prisma/client";
import { SignJWT } from "jose";

import { FORUM_MEMBER_EMAIL } from "./config";

/*
 * Same method as e2e/forum-member.spec.ts: a ForumSession row plus a cookie signed with the forum secret.
 * The cookie names the row, so deleting the row makes the cookie worthless. The secret is read from the
 * environment and never printed.
 */
const FORUM_AUDIENCE = "aso-computacion-forum";
const FORUM_SESSION_TYPE = "forum-session";
const SESSION_MINUTES = 60;

export interface MintedForumSession {
  token: string;
  /** Deletes the row this session created. Safe to call twice. */
  revoke: () => Promise<void>;
}

export async function mintForumSession(prisma: PrismaClient): Promise<MintedForumSession> {
  const secret = process.env.FORUM_SESSION_SECRET ?? "";

  if (secret.length < 32) throw new Error("FORUM_SESSION_SECRET is missing or shorter than 32 characters in .env.local.");

  const member = await prisma.forumMember.findUnique({ where: { email: FORUM_MEMBER_EMAIL }, select: { id: true } });

  if (!member) throw new Error(`No forum member ${FORUM_MEMBER_EMAIL}: run \`npm run seed:demo\` first.`);

  const sid = `ui-audit-${randomUUID()}`;
  const now = new Date();

  await prisma.forumSession.create({ data: { id: sid, memberId: member.id, expiresAt: new Date(now.getTime() + SESSION_MINUTES * 60_000), lastSeenAt: now } });

  const issued = Math.floor(now.getTime() / 1000);
  const token = await new SignJWT({ sid, mid: member.id, typ: FORUM_SESSION_TYPE })
    .setSubject(member.id)
    .setAudience(FORUM_AUDIENCE)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(issued)
    .setExpirationTime(issued + SESSION_MINUTES * 60)
    .sign(new TextEncoder().encode(secret));

  return { token, revoke: async () => void (await prisma.forumSession.deleteMany({ where: { id: sid } })) };
}
