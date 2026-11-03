import "server-only";

import type { ForumSessionRecord, ForumSessionRepository } from "@/application/ports/forum.ports";
import type { ForumMember } from "@/domain/forum";

import { prisma } from "../prisma/client";
import { toForumMember } from "./forum-member-prisma.repository";

export class ForumSessionPrismaRepository implements ForumSessionRepository {
  async create(session: ForumSessionRecord): Promise<void> {
    await prisma.forumSession.create({ data: session });
  }

  async findWithMember(id: string): Promise<{ session: ForumSessionRecord; member: ForumMember } | null> {
    const row = await prisma.forumSession.findUnique({ where: { id }, include: { member: true } });

    if (!row) {
      return null;
    }

    const { member, ...session } = row;

    return { session, member: toForumMember(member) };
  }

  async touch(id: string, at: Date): Promise<void> {
    await prisma.forumSession.updateMany({ where: { id }, data: { lastSeenAt: at } });
  }

  async revoke(id: string, at: Date): Promise<boolean> {
    const { count } = await prisma.forumSession.updateMany({ where: { id, revokedAt: null }, data: { revokedAt: at } });

    return count > 0;
  }
}
