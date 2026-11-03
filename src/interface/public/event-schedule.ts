import type { EventDatePrecision } from "@/domain/event";

/** Ecuador is UTC-5 all year (no daylight saving). */
const ECUADOR_OFFSET_HOURS = 5;
/** `9:05`, `09:00`, `14h30`, `8h`: a time of day written the way an organiser types it. */
const TIME_PATTERN = /(?<![\d:])(\d{1,2})(?:[:h](\d{2})|h)(?!\d)/g;

export interface EventSchedule {
  allDay: boolean;
  /** `YYYY-MM-DD` for an all-day event, else `YYYY-MM-DDTHH:mm:00-05:00`. */
  startLocal: string;
  endLocal: string | null;
  startUtc: Date | null;
  endUtc: Date | null;
}

interface Clock {
  hours: number;
  minutes: number;
}

function clocksIn(hora: string | null): Clock[] {
  return [...(hora ?? "").matchAll(TIME_PATTERN)]
    .map((match) => ({ hours: Number(match[1]), minutes: Number(match[2] ?? 0) }))
    .filter(({ hours, minutes }) => hours <= 23 && minutes <= 59);
}

const pad = (value: number) => String(value).padStart(2, "0");

function atClock(date: string, { hours, minutes }: Clock) {
  const [year, month, day] = date.split("-").map(Number) as [number, number, number];

  return {
    local: `${date}T${pad(hours)}:${pad(minutes)}:00-0${ECUADOR_OFFSET_HOURS}:00`,
    utc: new Date(Date.UTC(year, month - 1, day, hours + ECUADOR_OFFSET_HOURS, minutes)),
  };
}

/**
 * When an event happens, from its day and the free-text `hora`. The first readable time is the start and the
 * next one the end (ignored unless it is after the start); with none, the event is all day. Null unless the
 * day is exact: a month-only or undated event has no schedule to publish.
 */
export function eventSchedule(date: string | null, precision: EventDatePrecision, hora: string | null): EventSchedule | null {
  if (date === null || precision !== "day") {
    return null;
  }

  const [first, second] = clocksIn(hora);

  if (!first) {
    return { allDay: true, startLocal: date, endLocal: null, startUtc: null, endUtc: null };
  }

  const start = atClock(date, first);
  const end = second ? atClock(date, second) : null;
  const validEnd = end && end.utc.getTime() > start.utc.getTime() ? end : null;

  return { allDay: false, startLocal: start.local, endLocal: validEnd?.local ?? null, startUtc: start.utc, endUtc: validEnd?.utc ?? null };
}

