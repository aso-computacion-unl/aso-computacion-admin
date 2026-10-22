interface TimelineEvent {
  /** YYYY-MM-DD */
  date: string | null;
  /** Month-only dates order, and count as past or upcoming, as the first of their month (the landing's rule). */
  datePrecision?: "day" | "month";
  isPublished: boolean;
  updatedAt: Date;
}

export interface EventGroups<E extends TimelineEvent> {
  /** Unpublished, most recently edited first: the branch that has not been merged. */
  drafts: E[];
  /** Published, today or later. Farthest first, so the next one sits right above HEAD. */
  upcoming: E[];
  /** Published, earlier than today or undated. Most recent first, undated last. */
  past: E[];
}

const LOJA_TIME_ZONE = "America/Guayaquil";

/** Today's calendar date (YYYY-MM-DD) where the board lives, so "today" does not flip at 19:00 local time. */
export function todayInLoja(now: Date): string {
  // The `en-CA` locale formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: LOJA_TIME_ZONE }).format(now);
}

function effectiveDate(event: TimelineEvent): string | null {
  return event.date !== null && event.datePrecision === "month" ? `${event.date.slice(0, 7)}-01` : event.date;
}

/** Newest date first; an undated event goes after every dated one. Array#sort is stable, so ties keep their order. */
function byDateDescending(a: TimelineEvent, b: TimelineEvent): number {
  const [dateA, dateB] = [effectiveDate(a), effectiveDate(b)];

  if (dateA === dateB) return 0;
  if (dateA === null) return 1;
  if (dateB === null) return -1;

  return dateA < dateB ? 1 : -1;
}

export function groupEvents<E extends TimelineEvent>(events: readonly E[], today: string): EventGroups<E> {
  const drafts = events.filter((event) => !event.isPublished).sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  const published = events.filter((event) => event.isPublished).sort(byDateDescending);

  return {
    drafts,
    upcoming: published.filter((event) => {
      const date = effectiveDate(event);

      return date !== null && date >= today;
    }),
    past: published.filter((event) => {
      const date = effectiveDate(event);

      return date === null || date < today;
    }),
  };
}

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"] as const;

/** "22 oct 2026", or "oct 2026" for a month-only date. Built by hand (no ICU) so it reads the same in every runtime. */
export function formatEventDate(date: string | null, precision: "day" | "month" = "day"): string {
  if (date === null) return "Sin fecha";

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const month = match ? MONTHS[Number(match[2]) - 1] : undefined;

  if (!match || !month) return date;

  return precision === "month" ? `${month} ${match[1]}` : `${Number(match[3])} ${month} ${match[1]}`;
}
