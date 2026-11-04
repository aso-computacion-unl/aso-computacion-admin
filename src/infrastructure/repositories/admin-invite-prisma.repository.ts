import "server-only";

import { Prisma, type AdminInvite as AdminInviteRow } from "@/generated/prisma/client";

import type { AdminInviteRecord, AdminInviteRepository, InviteRedemption } from "@/application/ports/auth.ports";
import type { AdminInvite } from "@/domain/admin-invite";
import type { User } from "@/domain/user";

import { prisma } from "../prisma/client";

function toInvite(row: AdminInviteRow): AdminInvite {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    createdById: row.createdById,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    usedAt: row.usedAt,
    usedByUserId: row.usedByUserId,
    revokedAt: row.revokedAt,
  };
}

const pendingAt = (now: Date) => ({ usedAt: null, revokedAt: null, expiresAt: { gt: now } });

/** Thrown inside the redemption transaction to roll the invite's claim back. */
class RedemptionRefused extends Error {
  constructor(readonly outcome: Exclude<InviteRedemption, "ok">) {
    super(outcome);
  }
}

export class AdminInvitePrismaRepository implements AdminInviteRepository {
  async create(invite: AdminInviteRecord): Promise<string[]> {
    return prisma.$transaction(async (tx) => {
      // RETURNING reports exactly the rows this statement revoked, which `updateMany` (a count) cannot.
      const revoked = await tx.$queryRaw<{ id: string }[]>`
        UPDATE "AdminInvite" SET "revokedAt" = ${invite.createdAt}
        WHERE "email" = ${invite.email} AND "usedAt" IS NULL AND "revokedAt" IS NULL AND "expiresAt" > ${invite.createdAt}
        RETURNING "id"`;

      await tx.adminInvite.create({ data: invite });

      return revoked.map((row) => row.id);
    });
  }

  async findByTokenHash(tokenHash: string): Promise<AdminInvite | null> {
    const row = await prisma.adminInvite.findUnique({ where: { tokenHash } });

    return row && toInvite(row);
  }

  async listPending(now: Date): Promise<AdminInvite[]> {
    return (await prisma.adminInvite.findMany({ where: pendingAt(now), orderBy: { createdAt: "desc" } })).map(toInvite);
  }

  async revoke(id: string, at: Date): Promise<boolean> {
    return (await prisma.adminInvite.updateMany({ where: { id, ...pendingAt(at) }, data: { revokedAt: at } })).count === 1;
  }

  async redeem(inviteId: string, user: User): Promise<InviteRedemption> {
    try {
      await prisma.$transaction(async (tx) => {
        // The conditional update is the claim: of two concurrent redemptions only one sees the row
        // still pending (the other waits on the row lock, then matches nothing).
        const claimed = await tx.adminInvite.updateMany({
          where: { id: inviteId, email: user.email, ...pendingAt(user.createdAt) },
          data: { usedAt: user.createdAt, usedByUserId: user.id },
        });

        if (claimed.count !== 1) {
          throw new RedemptionRefused("unavailable");
        }

        try {
          await tx.user.create({ data: user });
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            throw new RedemptionRefused("email-taken");
          }

          throw error;
        }
      });

      return "ok";
    } catch (error) {
      if (error instanceof RedemptionRefused) {
        return error.outcome;
      }

      throw error;
    }
  }
}
