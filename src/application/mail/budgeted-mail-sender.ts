import { todayInEcuador } from "@/domain/calendar-date";

import type { MailBudget, MailMessage, MailSendResult, MailSender, MailTransport } from "../ports/mail.ports";

/**
 * The only `MailSender`: every send, whatever its reason, first takes one unit of the Ecuador day's budget, so the
 * provider's daily cap holds no matter how many callers or instances send. Without a transport (credentials not set)
 * nothing is tried and nothing is spent.
 */
export class BudgetedMailSender implements MailSender {
  constructor(
    private readonly transport: MailTransport | null,
    private readonly budget: MailBudget,
    private readonly dailyLimit: number,
  ) {}

  isConfigured(): boolean {
    return this.transport !== null;
  }

  async send(message: MailMessage, now: Date = new Date()): Promise<MailSendResult> {
    if (!this.transport) {
      return { status: "not_configured" };
    }

    const day = todayInEcuador(now);

    if (!(await this.budget.reserve(day, this.dailyLimit))) {
      return { status: "budget_exhausted" };
    }

    try {
      await this.transport.deliver(message);

      return { status: "sent" };
    } catch {
      // Nothing went out, so the unit goes back; if even that fails the day is merely counted short, which is the safe side.
      await this.budget.release(day).catch(() => undefined);

      return { status: "failed" };
    }
  }

  async remainingToday(now: Date = new Date()): Promise<number> {
    if (!this.transport) {
      return 0;
    }

    return Math.max(0, this.dailyLimit - (await this.budget.used(todayInEcuador(now))));
  }
}
