import { formatEventDate, todayInLoja } from "./events/event-timeline";

const TIME_ZONE = "America/Guayaquil";
const DAY_LABEL = new Intl.DateTimeFormat("es-EC", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: TIME_ZONE });
// 24 hours: "09:05" never wraps the way "9:05 a. m." does in a narrow column.
const CLOCK = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: TIME_ZONE });

export interface DayGroup<T> {
  /** YYYY-MM-DD in Ecuador. */
  key: string;
  /** "Hoy", "Ayer" or "martes, 20 de octubre de 2026". */
  label: string;
  items: T[];
}

function yesterdayOf(day: string): string {
  const date = new Date(`${day}T12:00:00Z`);

  date.setUTCDate(date.getUTCDate() - 1);

  return date.toISOString().slice(0, 10);
}

function relativeDay(day: string, now: Date): "hoy" | "ayer" | null {
  const today = todayInLoja(now);

  if (day === today) return "hoy";
  if (day === yesterdayOf(today)) return "ayer";

  return null;
}

/** Consecutive entries of the same day (in Ecuador) under one heading; the entries keep the order they came in. */
export function groupByDay<T>(items: readonly T[], at: (item: T) => Date, now: Date): DayGroup<T>[] {
  const groups: DayGroup<T>[] = [];

  for (const item of items) {
    const key = todayInLoja(at(item));
    const last = groups.at(-1);

    if (last?.key === key) {
      last.items.push(item);
      continue;
    }

    const relative = relativeDay(key, now);

    groups.push({ key, label: relative === "hoy" ? "Hoy" : relative === "ayer" ? "Ayer" : DAY_LABEL.format(at(item)), items: [item] });
  }

  return groups;
}

/** "09:05", in Ecuador. */
export function formatClock(at: Date): string {
  return CLOCK.format(at);
}

/** "hoy 09:05", "ayer 09:05" or "3 nov 2026 09:05". */
export function formatStamp(at: Date, now: Date): string {
  const day = todayInLoja(at);

  return `${relativeDay(day, now) ?? formatEventDate(day)} ${formatClock(at)}`;
}

/** The first eight characters of an identifier: enough to tell two apart in a list. */
export function shortId(id: string): string {
  return id.slice(0, 8);
}
