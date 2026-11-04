// Small presentation rules for the forum pages: kept out of the components so they can be tested on their own.

const FORUM_TIME_ZONE = "America/Guayaquil";
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const dateFormat = new Intl.DateTimeFormat("es", { day: "numeric", month: "short", year: "numeric", timeZone: FORUM_TIME_ZONE });
const dateTimeFormat = new Intl.DateTimeFormat("es", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: FORUM_TIME_ZONE });

const isWhitespace = (character: string | undefined): boolean => character !== undefined && character.trim() === "";

/**
 * Replaces each " de " (the word between whitespace, any run of it) with a single space. A scan because
 * `/\s+de\s+/g` backtracks on a long run of whitespace.
 */
function collapseDe(text: string): string {
  let result = "";
  let position = 0;

  while (position < text.length) {
    if (!isWhitespace(text[position])) {
      result += text[position];
      position += 1;
      continue;
    }

    let wordStart = position;
    while (isWhitespace(text[wordStart])) wordStart += 1;

    if (!text.startsWith("de", wordStart) || !isWhitespace(text[wordStart + 2])) {
      result += text.slice(position, wordStart);
      position = wordStart;
      continue;
    }

    let next = wordStart + 2;
    while (isWhitespace(text[next])) next += 1;

    result += " ";
    position = next;
  }

  return result;
}

/** "hace 12 min", "hace 3 h", "ayer", "hace 5 d"; a date from a month on. A date in the future counts as now. */
export function formatRelativeTime(date: Date, now: Date): string {
  const elapsed = Math.max(0, now.getTime() - date.getTime());

  if (elapsed < MINUTE) return "hace un momento";
  if (elapsed < HOUR) return `hace ${Math.floor(elapsed / MINUTE)} min`;
  if (elapsed < DAY) return `hace ${Math.floor(elapsed / HOUR)} h`;
  if (elapsed < 2 * DAY) return "ayer";
  if (elapsed < 30 * DAY) return `hace ${Math.floor(elapsed / DAY)} d`;

  return collapseDe(dateFormat.format(date).replace(/\./g, ""));
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

/** Hues in the category chip palette (`.chip[data-hue]` in forum.css). */
export const CATEGORY_HUES = 5;

// The three seeded categories get fixed, distinct slots so they never share a colour.
const SEEDED_HUES: Record<string, number> = { general: 0, materias: 1, propuestas: 2 };

/** The palette slot of a category chip: fixed for the seeded categories, a stable hash of the slug for any other. */
export function categoryHue(slug: string): number {
  const seeded = SEEDED_HUES[slug];

  if (seeded !== undefined) return seeded;

  let hash = 0;
  for (const char of slug) hash = (hash * 31 + (char.codePointAt(0) ?? 0)) % 9973;

  return hash % CATEGORY_HUES;
}
