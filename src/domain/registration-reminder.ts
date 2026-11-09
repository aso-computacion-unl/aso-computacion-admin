import { todayInEcuador } from "./calendar-date";

/** A reminder goes out between this many days before the event and... */
export const REMINDER_DAYS_AHEAD_MIN = 1;
/** ...this many: three days of room to spread the mail over, the last chance being the day before. */
export const REMINDER_DAYS_AHEAD_MAX = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

function addDays(day: string, days: number): string {
  return new Date(new Date(`${day}T00:00:00.000Z`).getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

/** The event days (YYYY-MM-DD, Ecuador) whose people are due a reminder now: tomorrow up to three days ahead, both included. */
export function reminderWindow(now: Date): { from: string; to: string } {
  const today = todayInEcuador(now);

  return { from: addDays(today, REMINDER_DAYS_AHEAD_MIN), to: addDays(today, REMINDER_DAYS_AHEAD_MAX) };
}

/** Whether an event on `date` is inside the reminder window. An event without an exact day never is. */
export function isInReminderWindow(date: string | null, now: Date): boolean {
  if (date === null) return false;

  const { from, to } = reminderWindow(now);

  return date >= from && date <= to;
}
