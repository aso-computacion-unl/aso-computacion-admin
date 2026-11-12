import type { MailBudget, MailMessage, MailSendResult, MailSender, MailTransport } from "@/application/ports/mail.ports";

/** Deterministic in-memory `MailBudget`: the same atomic rule as the Postgres one, one counter per Ecuador day. */
export class InMemoryMailBudget implements MailBudget {
  private readonly counters = new Map<string, number>();

  async reserve(day: string, limit: number): Promise<boolean> {
    const used = this.counters.get(day) ?? 0;

    if (limit < 1 || used >= limit) {
      return false;
    }

    this.counters.set(day, used + 1);

    return true;
  }

  async release(day: string): Promise<void> {
    this.counters.set(day, Math.max(0, (this.counters.get(day) ?? 0) - 1));
  }

  async used(day: string): Promise<number> {
    return this.counters.get(day) ?? 0;
  }
}

/** A `MailTransport` that records what would have been delivered and can be told to fail. */
export class RecordingMailTransport implements MailTransport {
  readonly delivered: MailMessage[] = [];
  /** Recipients whose delivery throws. */
  readonly failing = new Set<string>();

  async deliver(message: MailMessage): Promise<void> {
    if (this.failing.has(message.to)) {
      throw new Error("SMTP rejected the message");
    }

    this.delivered.push(message);
  }
}

/**
 * A `MailSender` for tests of the callers: records the messages, can report any non-sent status, and keeps a simple
 * daily allowance so budget-aware code (reminders) can be driven without the real sender.
 */
export class RecordingMailSender implements MailSender {
  readonly sent: MailMessage[] = [];
  /** Every attempt in order, including the refused and failed ones. */
  readonly attempts: MailMessage[] = [];
  /** When set, every `send` answers with it instead of delivering. */
  refuse: Exclude<MailSendResult["status"], "sent"> | null = null;
  /** Recipients whose send fails. */
  readonly failing = new Set<string>();

  constructor(public allowance = Number.POSITIVE_INFINITY) {}

  isConfigured(): boolean {
    return this.refuse !== "not_configured";
  }

  async send(message: MailMessage): Promise<MailSendResult> {
    this.attempts.push(message);

    if (this.refuse) {
      return { status: this.refuse };
    }

    if (this.sent.length >= this.allowance) {
      return { status: "budget_exhausted" };
    }

    if (this.failing.has(message.to)) {
      return { status: "failed" };
    }

    this.sent.push(message);

    return { status: "sent" };
  }

  async close(): Promise<void> {}

  dailyLimit(): number {
    return this.allowance;
  }

  async remainingToday(): Promise<number> {
    return this.refuse === "not_configured" ? 0 : Math.max(0, this.allowance - this.sent.length);
  }
}
