/** One email to one person. Plain text is always there; HTML is an optional nicer version of the same content. */
export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * `sent`: handed to the provider. `not_configured`: no provider credentials, nothing was tried. `budget_exhausted`:
 * today's allowance is spent, nothing was tried. `failed`: the provider refused or could not be reached; the allowance
 * is given back.
 */
export type MailSendResult = { status: "sent" | "not_configured" | "budget_exhausted" | "failed" };

/**
 * What the rest of the app uses to send email. It knows nothing about the provider behind it: Gmail today, and a
 * transactional service with an own domain later, by swapping the `MailTransport` it is built on.
 */
export interface MailSender {
  /** Whether a provider is set up at all. `false`: every send answers `not_configured`. */
  isConfigured(): boolean;
  /** Sends one message, spending one unit of today's budget (Ecuador day). Throws only when the budget itself cannot be reached. */
  send(message: MailMessage, now?: Date): Promise<MailSendResult>;
  /** How many more messages today's budget allows; 0 when nothing can be sent at all. */
  remainingToday(now?: Date): Promise<number>;
  /** Releases what a burst of sends kept open (a pooled connection). Safe to call when there is nothing to release. */
  close(): Promise<void>;
}

/** The provider adapter: delivers one message or throws. No budget, no policy. */
export interface MailTransport {
  deliver(message: MailMessage): Promise<void>;
  /** Optional: releases a connection kept open between sends. */
  close?(): Promise<void> | void;
}

/** The daily send counter, one per Ecuador calendar day (`YYYY-MM-DD`), shared by every instance. */
export interface MailBudget {
  /** Takes one unit of `day` unless `limit` is already reached. Atomic: parallel callers never go past the limit. A limit below 1 always refuses. */
  reserve(day: string, limit: number): Promise<boolean>;
  /** Gives one unit of `day` back, never below zero. */
  release(day: string): Promise<void>;
  /** Units taken on `day`; 0 when none. */
  used(day: string): Promise<number>;
}
