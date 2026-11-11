import { isPubliclyVisible } from "@/domain/publication-window";
import { isInReminderWindow, reminderMailAllowance } from "@/domain/registration-reminder";

import type { EventResult } from "../dto/event-result.dto";
import type { EventRegistrationRecord, EventRegistrationRepository } from "../ports/event-registration-repository.port";
import type { EventRepository } from "../ports/event-repository.port";
import type { MailMessage, MailSender } from "../ports/mail.ports";
import { soonestFirst } from "./soonest-first";

/** The provider failing this many sends in a row is the provider, not the addresses: stop for today instead of trying everyone. */
export const REMINDER_MAX_CONSECUTIVE_FAILURES = 3;

/** What a reminder says about its event. */
export type ReminderEvent = Pick<EventResult, "id" | "slug" | "title" | "date" | "datePrecision" | "hora" | "lugar">;

/** Who a reminder is for: enough to build a link that is theirs alone (the cancellation of their registration, D7). */
export type ReminderRecipient = Pick<EventRegistrationRecord, "id">;

type ReminderMessage = Pick<MailMessage, "subject" | "text" | "html">;

/** The subject and body of the reminder of one person for one event; built by the caller, which knows the site's address and signs the person's links. */
export type ReminderMessageBuilder = (event: ReminderEvent, person: ReminderRecipient) => ReminderMessage | Promise<ReminderMessage>;

/**
 * `done`: everything due was handled (a failed one stays due for tomorrow). `budget`: today's mail budget ran out
 * with people still due. `time`: the function's time ran out. `provider`: several sends failed in a row.
 * `not_configured`: no mail provider, or no address to build the links with; nothing was tried.
 */
export interface ReminderRunResult {
  sent: number;
  failed: number;
  /** Events inside the reminder window. */
  events: number;
  stoppedBy: "done" | "budget" | "time" | "provider" | "not_configured";
}

/**
 * Reminds the confirmed people of every public event one to three days ahead (Ecuador), once each. Spread over days:
 * each run sends up to what is left of the reminders' share of the day's mail budget (about 70 %, the rest is kept
 * for confirmation emails), nearest events first, so what does not fit goes out the
 * next day and the people of the nearest event are never starved by a farther one. A reminder is recorded only after
 * its send succeeded, so a failed send stays due and a repeated run sends nothing twice. Run from the daily cron.
 */
export class SendRegistrationRemindersUseCase {
  constructor(
    private readonly events: EventRepository,
    private readonly registrations: EventRegistrationRepository,
    private readonly mailer: MailSender,
    private readonly buildMessage: ReminderMessageBuilder | null,
  ) {}

  async execute({ now = new Date(), shouldStop = () => false }: { now?: Date; shouldStop?: () => boolean } = {}): Promise<ReminderRunResult> {
    if (!this.buildMessage || !this.mailer.isConfigured()) {
      return { sent: 0, failed: 0, events: 0, stoppedBy: "not_configured" };
    }

    const published = (await this.events.list({ status: "published" })).map((event) => event.props);
    const due = published.filter((event) => event.registrationMode !== "none" && event.datePrecision === "day" && isInReminderWindow(event.date, now) && isPubliclyVisible(event, now)).sort(soonestFirst);
    const result: ReminderRunResult = { sent: 0, failed: 0, events: due.length, stoppedBy: "done" };
    // Only what is left of the reminders' share of the cap (D12): the rest of the day's mail is for confirmations.
    let remaining = reminderMailAllowance(this.mailer.dailyLimit(), await this.mailer.remainingToday(now));
    let failuresInARow = 0;

    for (const event of due) {
      // A few more than the budget allows: someone left over tells that the budget, not the list, ended the day, and the
      // extra ones stand in for the sends that fail without spending anything.
      const people = await this.registrations.listDueForReminder(event.id, remaining + REMINDER_MAX_CONSECUTIVE_FAILURES + 1);

      for (const person of people) {
        if (remaining <= 0) return { ...result, stoppedBy: "budget" };
        if (shouldStop()) return { ...result, stoppedBy: "time" };

        let message: ReminderMessage;

        try {
          message = await this.buildMessage(event, person);
        } catch {
          // Not the provider's fault (a link that cannot be signed): this one stays due, the others still go out.
          result.failed += 1;
          continue;
        }

        const sent = await this.mailer.send({ to: person.email, ...message }, now);

        if (sent.status === "sent") {
          await this.registrations.markReminderSent(event.id, person.id, now);
          result.sent += 1;
          remaining -= 1;
          failuresInARow = 0;
        } else if (sent.status === "budget_exhausted") {
          return { ...result, stoppedBy: "budget" };
        } else if (sent.status === "not_configured") {
          return { ...result, stoppedBy: "not_configured" };
        } else {
          result.failed += 1;
          failuresInARow += 1;

          if (failuresInARow >= REMINDER_MAX_CONSECUTIVE_FAILURES) return { ...result, stoppedBy: "provider" };
        }
      }
    }

    return result;
  }
}
