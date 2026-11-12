import "server-only";

import { Prisma, type ForumMember as ForumMemberRow } from "@/generated/prisma/client";

import type { ForumMemberCriteria, ForumMemberDirectory } from "@/application/forum/forum-members.use-cases";
import type { ForumMemberRepository } from "@/application/ports/forum.ports";
import type { ForumMember } from "@/domain/forum";

import { prisma } from "../prisma/client";
import { searchWhere } from "./publication-filter";

/** The member as the domain knows it; also used by the session repository's join. */
export function toForumMember(row: ForumMemberRow): ForumMember {
  return {
    id: row.id,
    email: row.email,
    googleSub: row.googleSub,
    displayName: row.displayName,
    status: row.status,
    suspendedAt: row.suspendedAt,
    createdAt: row.createdAt,
    lastLoginAt: row.lastLoginAt,
  };
}

export class ForumMemberPrismaRepository implements ForumMemberRepository, ForumMemberDirectory {
  async findById(id: string): Promise<ForumMember | null> {
    const row = await prisma.forumMember.findUnique({ where: { id } });

    return row && toForumMember(row);
  }

  async findByGoogleSub(sub: string): Promise<ForumMember | null> {
    const row = await prisma.forumMember.findUnique({ where: { googleSub: sub } });

    return row && toForumMember(row);
  }

  async findByEmail(email: string): Promise<ForumMember | null> {
    const row = await prisma.forumMember.findUnique({ where: { email } });

    return row && toForumMember(row);
  }

  async create(member: ForumMember): Promise<boolean> {
    try {
      await prisma.forumMember.create({ data: member });
      return true;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return false;
      }

      throw error;
    }
  }

  async recordLogin(id: string, at: Date): Promise<void> {
    await prisma.forumMember.updateMany({ where: { id }, data: { lastLoginAt: at } });
  }

  async list({ filter, search }: ForumMemberCriteria, page: { offset: number; limit: number }) {
    const where: Prisma.ForumMemberWhereInput = { ...(filter === "suspended" ? { status: "SUSPENDED" } : {}), ...searchWhere(search, ["displayName", "email"]) };
    const [rows, total] = await Promise.all([
      prisma.forumMember.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "asc" }], skip: page.offset, take: page.limit }),
      prisma.forumMember.count({ where }),
    ]);

    return { items: rows.map(toForumMember), total };
  }
}
