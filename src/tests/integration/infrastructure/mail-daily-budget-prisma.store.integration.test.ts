import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { BudgetedMailSender } from "@/application/mail/budgeted-mail-sender";
import { prisma } from "@/infrastructure/prisma/client";
import { MailDailyBudgetPrismaStore } from "@/infrastructure/repositories/mail-daily-budget-prisma.store";
import { RecordingMailTransport } from "@/tests/fakes/in-memory-mail";

const budget = new MailDailyBudgetPrismaStore();
const DAY = "2026-11-20";
const OTHER_DAY = "2026-11-21";

describe("mail daily budget (Postgres)", () => {
  it("reserves one unit per call until the limit and refuses after it, leaving the counter at the limit", async () => {
    expect(await budget.reserve(DAY, 3)).toBe(true);
    expect(await budget.reserve(DAY, 3)).toBe(true);
    expect(await budget.reserve(DAY, 3)).toBe(true);
    expect(await budget.reserve(DAY, 3)).toBe(false);
    expect(await budget.reserve(DAY, 3)).toBe(false);

    expect(await budget.used(DAY)).toBe(3);
    expect(await prisma.mailDailyCounter.findMany()).toEqual([{ day: DAY, sent: 3 }]);
  });

  it("never goes past the limit when many reservations race", async () => {
    const results = await Promise.all(Array.from({ length: 40 }, () => budget.reserve(DAY, 7)));

    expect(results.filter(Boolean)).toHaveLength(7);
    expect(await budget.used(DAY)).toBe(7);
  });

  it("counts each day on its own, and a day nobody sent on reads zero", async () => {
    await budget.reserve(DAY, 1);

    expect(await budget.reserve(DAY, 1)).toBe(false);
    expect(await budget.reserve(OTHER_DAY, 1)).toBe(true);
    expect(await budget.used(DAY)).toBe(1);
    expect(await budget.used("2026-12-01")).toBe(0);
  });

  it("applies the limit given on each call, so raising it frees the rest of the day", async () => {
    await budget.reserve(DAY, 1);

    expect(await budget.reserve(DAY, 1)).toBe(false);
    expect(await budget.reserve(DAY, 2)).toBe(true);
    expect(await budget.reserve(DAY, 2)).toBe(false);
  });

  it("refuses everything with a limit below 1, without creating a row", async () => {
    expect(await budget.reserve(DAY, 0)).toBe(false);
    expect(await budget.reserve(DAY, -4)).toBe(false);
    expect(await prisma.mailDailyCounter.count()).toBe(0);
  });

  it("gives a unit back, never below zero, and only for that day", async () => {
    await budget.reserve(DAY, 5);
    await budget.reserve(OTHER_DAY, 5);

    await budget.release(DAY);
    await budget.release(DAY);
    await budget.release("2026-12-01");

    expect(await budget.used(DAY)).toBe(0);
    expect(await budget.used(OTHER_DAY)).toBe(1);
    expect(await prisma.mailDailyCounter.findUnique({ where: { day: "2026-12-01" } })).toBeNull();
  });

  it("refuses a malformed day and a negative count at the database", async () => {
    await expect(prisma.mailDailyCounter.create({ data: { day: "20-11-2026", sent: 1 } })).rejects.toThrow();
    await expect(prisma.mailDailyCounter.create({ data: { day: DAY, sent: -1 } })).rejects.toThrow();
    expect(await prisma.mailDailyCounter.count()).toBe(0);
  });

  it("is what makes every send of the sender count: the daily cap holds across senders and concurrent callers", async () => {
    const transport = new RecordingMailTransport();
    const senders = [new BudgetedMailSender(transport, budget, 4), new BudgetedMailSender(transport, new MailDailyBudgetPrismaStore(), 4)];
    const noon = new Date("2026-11-20T17:00:00.000Z");

    const results = await Promise.all(Array.from({ length: 12 }, (_, index) => senders[index % 2]!.send({ to: `p${index}@example.com`, subject: "s", text: "t" }, noon)));

    expect(results.filter((result) => result.status === "sent")).toHaveLength(4);
    expect(transport.delivered).toHaveLength(4);
    expect(await budget.used(DAY)).toBe(4);
  });
});
