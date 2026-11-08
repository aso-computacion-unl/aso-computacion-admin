import "server-only";

import type { MailBudget } from "@/application/ports/mail.ports";

import { prisma } from "../prisma/client";

/** The daily mail counter in Postgres, so every serverless instance spends from the same budget. */
export class MailDailyBudgetPrismaStore implements MailBudget {
  /** One statement: insert the day's first unit, or add one while below the limit. No row comes back at the limit, which is the refusal. */
  async reserve(day: string, limit: number): Promise<boolean> {
    if (limit < 1) {
      return false;
    }

    const reserved = await prisma.$queryRaw<{ sent: number }[]>`
      INSERT INTO "MailDailyCounter" ("day", "sent") VALUES (${day}, 1)
      ON CONFLICT ("day") DO UPDATE SET "sent" = "MailDailyCounter"."sent" + 1 WHERE "MailDailyCounter"."sent" < ${limit}
      RETURNING "sent"
    `;

    return reserved.length === 1;
  }

  async release(day: string): Promise<void> {
    await prisma.$executeRaw`UPDATE "MailDailyCounter" SET "sent" = GREATEST("sent" - 1, 0) WHERE "day" = ${day}`;
  }

  async used(day: string): Promise<number> {
    return (await prisma.mailDailyCounter.findUnique({ where: { day }, select: { sent: true } }))?.sent ?? 0;
  }
}
