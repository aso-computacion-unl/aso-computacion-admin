import { todayInEcuador } from "./calendar-date";

/** Registrations are personal data: they are deleted this many days after their event ends. */
export const REGISTRATION_RETENTION_DAYS = 90;

/** Ecuador is UTC-5 all year, so its midnight is 05:00 UTC. */
const ECUADOR_MIDNIGHT_UTC_HOUR = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

/** The slice of an event the retention rule reads. */
export interface RetainedEvent {
  readonly date: string | null;
  readonly datePrecision: "day" | "month";
}

function utcMidnight(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}

function addDays(day: string, days: number): string {
  return new Date(utcMidnight(day).getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

/** The last calendar day an event can happen on: its date, or the end of its month when only the month is known. */
export function eventLastDay(date: string, precision: "day" | "month"): string {
  if (precision === "day") {
    return date;
  }

  const [year, month] = [Number(date.slice(0, 4)), Number(date.slice(5, 7))];

  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

/**
 * The instant from which the registrations of an event are deleted: 90 full days after its last day ends
 * (midnight Ecuador), inclusive. `null` when the event has no date, because nothing says when it ended.
 */
function expiresAt(event: RetainedEvent): Date | null {
  if (!event.date) {
    return null;
  }

  const dayAfter = addDays(eventLastDay(event.date, event.datePrecision), 1);

  return new Date(utcMidnight(addDays(dayAfter, REGISTRATION_RETENTION_DAYS)).getTime() + ECUADOR_MIDNIGHT_UTC_HOUR * 60 * 60 * 1000);
}

export function registrationsExpired(event: RetainedEvent, now: Date): boolean {
  const expiry = expiresAt(event);

  return expiry !== null && now.getTime() >= expiry.getTime();
}

/**
 * The latest event date (YYYY-MM-DD) worth looking at: every event dated after it is certain to be inside the
 * retention period. It lets the database narrow the search; `registrationsExpired` still decides each event.
 */
export function retentionCandidateCutoff(now: Date): string {
  return addDays(todayInEcuador(now), -(REGISTRATION_RETENTION_DAYS + 1));
}
