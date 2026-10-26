import "server-only";

import { Prisma, type User as UserRow } from "@prisma/client";

import type { UserChangeOutcome, UserRepository } from "@/application/ports/auth.ports";
import type { Role, User } from "@/domain/user";

import { prisma } from "../prisma/client";

function toUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    active: row.active,
    createdAt: row.createdAt,
    lastLoginAt: row.lastLoginAt,
  };
}

export class UserPrismaRepository implements UserRepository {
  async findByEmail(email: string): Promise<User | null> {
    const row = await prisma.user.findUnique({ where: { email } });

    return row && toUser(row);
  }

  async findById(id: string): Promise<User | null> {
    const row = await prisma.user.findUnique({ where: { id } });

    return row && toUser(row);
  }

  async list(): Promise<User[]> {
    return (await prisma.user.findMany({ orderBy: { email: "asc" } })).map(toUser);
  }

  async create(user: User): Promise<boolean> {
    try {
      await prisma.user.create({ data: user });
      return true;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return false;
      }

      throw error;
    }
  }

  async applyChange(id: string, change: { role?: Role; active?: boolean }): Promise<UserChangeOutcome> {
    return prisma.$transaction(async (tx) => {
      // Lock every active admin first: two changes that could each leave "someone else" as the admin
      // are serialised here, so the second one sees the first one's result.
      const admins = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "User" WHERE "role" = 'ADMIN' AND "active" = true FOR UPDATE`;
      const current = await tx.user.findUnique({ where: { id } });

      if (!current) {
        return "not-found";
      }

      const staysActiveAdmin = (change.role ?? current.role) === "ADMIN" && (change.active ?? current.active);
      const isActiveAdmin = current.role === "ADMIN" && current.active;
      const otherActiveAdmins = admins.filter((admin) => admin.id !== id).length;

      if (isActiveAdmin && !staysActiveAdmin && otherActiveAdmins === 0) {
        return "last-admin";
      }

      await tx.user.update({ where: { id }, data: change });

      return "ok";
    });
  }

  async recordLogin(id: string, at: Date): Promise<void> {
    await prisma.user.update({ where: { id }, data: { lastLoginAt: at } });
  }
}
