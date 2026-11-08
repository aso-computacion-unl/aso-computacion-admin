import { beforeEach, describe, expect, it, vi } from "vitest";

import { BudgetedMailSender } from "@/application/mail/budgeted-mail-sender";
import type { MailMessage } from "@/application/ports/mail.ports";
import { InMemoryMailBudget, RecordingMailTransport } from "@/tests/fakes/in-memory-mail";

// 2026-11-20 20:00 in Ecuador (UTC-5) is already 2026-11-21 01:00 UTC: the budget day is the Ecuador one.
const EVENING = new Date("2026-11-21T01:00:00.000Z");
const NEXT_MORNING = new Date("2026-11-21T11:00:00.000Z");
const mail = (to = "ana@example.com"): MailMessage => ({ to, subject: "Hola", text: "Texto" });

let budget: InMemoryMailBudget;
let transport: RecordingMailTransport;

const sender = (limit = 3, withTransport: RecordingMailTransport | null = transport) => new BudgetedMailSender(withTransport, budget, limit);

beforeEach(() => {
  budget = new InMemoryMailBudget();
  transport = new RecordingMailTransport();
});

describe("BudgetedMailSender", () => {
  it("delivers through the transport and spends one unit of the day's budget per message", async () => {
    const mailer = sender();

    expect(await mailer.send(mail("a@example.com"), EVENING)).toEqual({ status: "sent" });
    expect(await mailer.send(mail("b@example.com"), EVENING)).toEqual({ status: "sent" });

    expect(transport.delivered.map((message) => message.to)).toEqual(["a@example.com", "b@example.com"]);
    expect(await budget.used("2026-11-20")).toBe(2);
    expect(await mailer.remainingToday(EVENING)).toBe(1);
  });

  it("refuses once the day's limit is reached, without delivering and without touching the counter", async () => {
    const mailer = sender(2);

    await mailer.send(mail(), EVENING);
    await mailer.send(mail(), EVENING);

    expect(await mailer.send(mail("late@example.com"), EVENING)).toEqual({ status: "budget_exhausted" });
    expect(transport.delivered).toHaveLength(2);
    expect(await budget.used("2026-11-20")).toBe(2);
    expect(await mailer.remainingToday(EVENING)).toBe(0);
  });

  it("never goes past the limit when many sends race for the last units", async () => {
    const mailer = sender(5);

    const results = await Promise.all(Array.from({ length: 20 }, (_, index) => mailer.send(mail(`p${index}@example.com`), EVENING)));

    expect(results.filter((result) => result.status === "sent")).toHaveLength(5);
    expect(results.filter((result) => result.status === "budget_exhausted")).toHaveLength(15);
    expect(transport.delivered).toHaveLength(5);
  });

  it("starts a fresh budget at midnight in Ecuador, not in UTC", async () => {
    const mailer = sender(1);

    expect(await mailer.send(mail(), EVENING)).toEqual({ status: "sent" });
    expect(await mailer.send(mail(), new Date("2026-11-21T04:59:59.999Z"))).toEqual({ status: "budget_exhausted" });
    expect(await mailer.send(mail(), new Date("2026-11-21T05:00:00.000Z"))).toEqual({ status: "sent" });
    expect(await mailer.remainingToday(NEXT_MORNING)).toBe(0);
  });

  it("gives the unit back when the transport fails, so a failed send does not eat the day's budget", async () => {
    const mailer = sender(2);

    transport.failing.add("bad@example.com");

    expect(await mailer.send(mail("bad@example.com"), EVENING)).toEqual({ status: "failed" });
    expect(await budget.used("2026-11-20")).toBe(0);
    expect(await mailer.send(mail("a@example.com"), EVENING)).toEqual({ status: "sent" });
    expect(await mailer.send(mail("b@example.com"), EVENING)).toEqual({ status: "sent" });
  });

  it("still answers failed when giving the unit back fails too", async () => {
    transport.failing.add("bad@example.com");
    vi.spyOn(budget, "release").mockRejectedValue(new Error("db down"));

    expect(await sender().send(mail("bad@example.com"), EVENING)).toEqual({ status: "failed" });
  });

  it("answers not_configured, spending nothing, when there is no transport", async () => {
    const mailer = sender(3, null);

    expect(await mailer.send(mail(), EVENING)).toEqual({ status: "not_configured" });
    expect(await budget.used("2026-11-20")).toBe(0);
    expect(await mailer.remainingToday(EVENING)).toBe(0);
  });

  it("says whether a provider is set up", () => {
    expect(sender().isConfigured()).toBe(true);
    expect(sender(3, null).isConfigured()).toBe(false);
  });

  it("sends nothing with a limit below 1", async () => {
    expect(await sender(0).send(mail(), EVENING)).toEqual({ status: "budget_exhausted" });
    expect(transport.delivered).toEqual([]);
  });

  it("does not let a budget failure turn into a delivery: the message is not sent and the error is not swallowed silently", async () => {
    vi.spyOn(budget, "reserve").mockRejectedValue(new Error("db down"));

    await expect(sender().send(mail(), EVENING)).rejects.toThrow("db down");
    expect(transport.delivered).toEqual([]);
  });
});
