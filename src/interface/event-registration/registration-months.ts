/*
 * The public registrations list split by month (S4, S5): the headings of the list and the words of its month filter.
 * Built by hand (no ICU), like `formatEventDate`, so it reads the same in every runtime. No server-only imports.
 */

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"] as const;

/** The key of the group that holds the events without a date. */
export const UNDATED_KEY = "undated";

export interface MonthGroup<T> {
  /** "2026-11", or `UNDATED_KEY`. */
  key: string;
  /** The heading over the group: "Noviembre", "Noviembre 2026" when the list spans years, "Fecha por definir". */
  heading: string;
  /** The month's stub in the filter, or null for the undated events, which have none (only "Todos" shows them). */
  name: string | null;
  /** The month in the status line ("Mostrando 4 eventos de noviembre"), or null for the undated events. */
  ofMonth: string | null;
  events: T[];
}

const capitalize = (word: string) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`;

/**
 * The events under one heading per month, in the order given (the list comes soonest first, undated last), with the
 * undated ones in a last group. The year joins the month names only when the dated events span more than one year.
 */
export function groupByMonth<T extends { date: string | null }>(events: readonly T[]): MonthGroup<T>[] {
  const byKey = new Map<string, T[]>();

  for (const event of events) {
    const key = event.date?.slice(0, 7) ?? UNDATED_KEY;
    const group = byKey.get(key);

    if (group) group.push(event);
    else byKey.set(key, [event]);
  }

  const years = new Set([...byKey.keys()].filter((key) => key !== UNDATED_KEY).map((key) => key.slice(0, 4)));
  const withYear = years.size > 1;
  const groups: MonthGroup<T>[] = [];

  for (const [key, grouped] of byKey) {
    const month = MONTHS[Number(key.slice(5, 7)) - 1];

    if (key === UNDATED_KEY || !month) continue;

    const year = key.slice(0, 4);
    const name = withYear ? `${capitalize(month)} ${year}` : capitalize(month);

    groups.push({ key, heading: name, name, ofMonth: withYear ? `${month} de ${year}` : month, events: grouped });
  }

  const undated = byKey.get(UNDATED_KEY);

  return undated ? [...groups, { key: UNDATED_KEY, heading: "Fecha por definir", name: null, ofMonth: null, events: undated }] : groups;
}

/** The count under a stub: "4 eventos", "1 evento". */
export function eventsCountText(count: number): string {
  return count === 1 ? "1 evento" : `${count} eventos`;
}

/** The status line under the filter: what the list shows right now. */
export function showingText(count: number, ofMonth: string | null): string {
  if (ofMonth === null) return `Mostrando los ${count} eventos`;

  return `Mostrando ${eventsCountText(count)} de ${ofMonth}`;
}
