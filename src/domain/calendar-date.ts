import { ValidationError } from "./domain-error";

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Ecuador is UTC-5 all year (no daylight saving), which is where the association is. */
const ECUADOR_UTC_OFFSET_MS = -5 * 60 * 60 * 1000;

/** Trims and requires a real calendar date written YYYY-MM-DD. */
export function assertCalendarDate(field: string, value: string): string {
  const trimmed = value.trim();
  const match = ISO_DATE_PATTERN.exec(trimmed);
  const [year, month, day] = match ? [Number(match[1]), Number(match[2]), Number(match[3])] : [];
  const parsed = match ? new Date(Date.UTC(year!, month! - 1, day!)) : null;

  if (
    !parsed ||
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month! - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new ValidationError(field, `${field} must be a valid calendar date (YYYY-MM-DD)`);
  }

  return trimmed;
}

/** The calendar date (YYYY-MM-DD) it is in Ecuador at `now`, which can differ from the UTC date. */
export function todayInEcuador(now: Date): string {
  return new Date(now.getTime() + ECUADOR_UTC_OFFSET_MS).toISOString().slice(0, 10);
}
