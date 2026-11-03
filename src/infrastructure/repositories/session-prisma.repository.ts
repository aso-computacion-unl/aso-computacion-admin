import "server-only";

import type { ActiveSessionView, SessionRecord, SessionRepository, SessionScope, SessionWithUser } from "@/application/ports/auth.ports";

import type { SessionKind } from "@/domain/user";

import { prisma } from "../prisma/client";

/** The database refuses "system" for a session (CHECK), so anything but break-glass is a user session. */
const sessionKind = (kind: string): SessionKind => (kind === "break_glass" ? "break_glass" : "user");

export class SessionPrismaRepository implements SessionRepository {
  async create(session: SessionRecord): Promise<void> {
    await prisma.session.create({ data: session });
  }

  async findWithUser(id: string): Promise<SessionWithUser | null> {
    const row = await prisma.session.findUnique({ where: { id }, include: { user: true } });

    if (!row) {
      return null;
    }

    const { user, ...session } = row;

    return { session: { ...session, kind: sessionKind(session.kind) }, user };
  }

  async touch(id: string, at: Date): Promise<void> {
    await prisma.session.updateMany({ where: { id }, data: { lastSeenAt: at } });
  }

  async revoke(id: string, at: Date): Promise<boolean> {
    const { count } = await prisma.session.updateMany({ where: { id, revokedAt: null }, data: { revokedAt: at } });

    return count > 0;
  }

  async revokeAllForUser(userId: string, at: Date): Promise<number> {
    const { count } = await prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: at } });

    return count;
  }

  async listActive(now: Date, scope: SessionScope): Promise<ActiveSessionView[]> {
    const rows = await prisma.session.findMany({
      where: { revokedAt: null, expiresAt: { gt: now }, ...(scope === "all" ? {} : { userId: scope.userId }) },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
    });

    return rows.map((row) => ({
      id: row.id,
      kind: sessionKind(row.kind),
      userId: row.userId,
      userName: row.user?.name ?? null,
      userEmail: row.user?.email ?? null,
      createdAt: row.createdAt,
      lastSeenAt: row.lastSeenAt,
      expiresAt: row.expiresAt,
      userAgent: row.userAgent,
    }));
  }
}
