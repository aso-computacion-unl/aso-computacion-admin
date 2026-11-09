import type { ReminderRunResult } from "@/application";

import { getRegistrationReminders } from "./registration-reminders-container";

/**
 * How much of the function's time the reminders may start sending in, counted from the moment the cron route began.
 * The function lives 60 s (`maxDuration` of the route) and the rebuild and the purge ran before this step; the last
 * 15 s are the margin for the send in flight, the closing of the connection and the answer.
 */
export const REMINDER_TIME_BUDGET_MS = 45_000;

/**
 * Sends the reminders due now (see `SendRegistrationRemindersUseCase`): up to the day's mail budget and the time the
 * function has, nearest events first. Returns counts only. A failure of the closing of the mail connection never
 * hides the result of a run that already sent.
 */
export async function runRegistrationReminders(now: Date, { startedAt }: { startedAt: number }): Promise<ReminderRunResult> {
  const reminders = getRegistrationReminders();

  try {
    return await reminders.execute({ now, shouldStop: () => Date.now() - startedAt >= REMINDER_TIME_BUDGET_MS });
  } finally {
    await Promise.resolve(reminders.close()).catch(() => undefined);
  }
}
