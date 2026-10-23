interface TimelineEvent {
  /** YYYY-MM-DD */
  date: string | null;
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

/** Newest date first; an undated event goes after every dated one. Array#sort is stable, so ties keep their order. */
function byDateDescending(a: TimelineEvent, b: TimelineEvent): number {
  if (a.date === b.date) return 0;
  if (a.date === null) return 1;
  if (b.date === null) return -1;

  return a.date < b.date ? 1 : -1;
}

export function groupEvents<E extends TimelineEvent>(events: readonly E[], today: string): EventGroups<E> {
  const drafts = events.filter((event) => !event.isPublished).sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  const published = events.filter((event) => event.isPublished).sort(byDateDescending);

  return {
    drafts,
    upcoming: published.filter((event) => event.date !== null && event.date >= today),
    past: published.filter((event) => event.date === null || event.date < today),
  };
}
