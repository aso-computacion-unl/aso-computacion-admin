// Small presentation rules for the forum pages: kept out of the components so they can be tested on their own.

const FORUM_TIME_ZONE = "America/Guayaquil";
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const dateFormat = new Intl.DateTimeFormat("es", { day: "numeric", month: "short", year: "numeric", timeZone: FORUM_TIME_ZONE });
const dateTimeFormat = new Intl.DateTimeFormat("es", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: FORUM_TIME_ZONE });

/** "hace 12 min", "hace 3 h", "ayer", "hace 5 d"; a date from a month on. A date in the future counts as now. */
export function formatRelativeTime(date: Date, now: Date): string {
  const elapsed = Math.max(0, now.getTime() - date.getTime());

  if (elapsed < MINUTE) return "hace un momento";
  if (elapsed < HOUR) return `hace ${Math.floor(elapsed / MINUTE)} min`;
  if (elapsed < DAY) return `hace ${Math.floor(elapsed / HOUR)} h`;
  if (elapsed < 2 * DAY) return "ayer";
  if (elapsed < 30 * DAY) return `hace ${Math.floor(elapsed / DAY)} d`;

  return dateFormat.format(date).replace(/\./g, "").replace(/\s+de\s+/g, " ");
}

/** The exact moment, for a tooltip or a `<time>` title: "26 oct 2026, 10:30". */
export function formatAbsoluteTime(date: Date): string {
  const part = (type: Intl.DateTimeFormatPartTypes) => dateTimeFormat.formatToParts(date).find((entry) => entry.type === type)?.value ?? "";

  return `${part("day")} ${part("month").replace(".", "")} ${part("year")}, ${part("hour")}:${part("minute")}`;
}

/** Up to two initials of a public name, for the avatar circle. */
export function initialsOf(name: string): string {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => Array.from(word)[0]!.toUpperCase());

  return letters.length > 0 ? letters.join("") : "?";
}

export type ThreadStatus = "open" | "solved" | "locked";

/** What the list and the thread header show: a best answer wins over a lock. */
export function threadStatus(thread: { hasBestAnswer: boolean; locked: boolean }): ThreadStatus {
  if (thread.hasBestAnswer) return "solved";

  return thread.locked ? "locked" : "open";
}

export type ThreadFilter = "open" | "solved";

/** The `?estado=` query of a category page; anything unknown is the default "Abiertos". */
export function parseThreadFilter(raw: string | string[] | undefined): ThreadFilter {
  return raw === "resueltos" ? "solved" : "open";
}

/** The `?pagina=` query: a positive safe integer, else the first page (the read clamps a page past the end). */
export function parsePageParam(raw: string | string[] | undefined): number {
  if (typeof raw !== "string" || !/^\d{1,9}$/.test(raw)) return 1;

  return Math.max(1, Number(raw));
}
