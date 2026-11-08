/*
 * What the event's ticket says about the date, the deadline and the seats. Built by hand (no ICU), like
 * `formatEventDate`, so the page reads the same in every runtime. No server-only imports.
 */

import { formatEventDate } from "@/interface/admin/events/event-timeline";

const WEEKDAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"] as const;

/** Ecuador has no daylight saving time: its offset to UTC is a constant (the public API's dates say `-05:00` too). */
const ECUADOR_OFFSET_MS = -5 * 3_600_000;

export interface TicketDate {
  /** "Sáb": only for an exact day. */
  weekday: string | null;
  /** The big figure of the stub: the day, or the month when the event has no exact day. */
  main: string;
  sub: string;
  /** The whole date as a sentence for the `<time>` element ("sáb 28 nov 2026"). */
  label: string;
  /** The machine-readable value for `<time datetime>`, or null when there is no date. */
  iso: string | null;
}

/** The date block of the ticket: weekday, day and month for an exact day; the month alone, or "por definir". */
export function ticketDate(date: string | null, precision: "day" | "month" = "day"): TicketDate {
  const match = date === null ? null : /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);

  if (date === null || !match) {
    return { weekday: null, main: "—", sub: "por definir", label: "Fecha por definir", iso: null };
  }

  const [month, year] = formatEventDate(date, "month").split(" ") as [string, string];

  if (precision === "month") {
    return { weekday: null, main: month, sub: year, label: `${month} ${year}`, iso: `${match[1]}-${match[2]}` };
  }

  const weekday = WEEKDAYS[new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))).getUTCDay()]!;
  const day = String(Number(match[3]));

  return { weekday, main: day, sub: `${month} ${year}`, label: `${weekday.toLowerCase()} ${day} ${month} ${year}`, iso: date };
}

/** "18 nov 2026, 18:00": the deadline in Ecuador's time, where the event and its students are. */
export function deadlineLabel(deadline: Date): string {
  const local = new Date(deadline.getTime() + ECUADOR_OFFSET_MS);
  const day = local.toISOString().slice(0, 10);
  const time = local.toISOString().slice(11, 16);

  return `${formatEventDate(day)}, ${time}`;
}

export interface TicketSeats {
  /** "Quedan 8 cupos". */
  left: string;
  /** How full the meter is, 0 to 100. */
  filled: number;
  /** "32 de 40 inscritos". */
  summary: string;
}

/** The seat counter of the ticket, or null for an event without a limit: no counter at all. */
export function seatsOf({ capacity, registered }: { capacity: number | null; registered: number }): TicketSeats | null {
  if (capacity === null) return null;

  const left = Math.max(0, capacity - registered);

  return {
    left: left === 1 ? "Queda 1 cupo" : `Quedan ${left} cupos`,
    filled: capacity > 0 ? Math.min(100, Math.round((registered / capacity) * 100)) : 100,
    summary: `${registered} de ${capacity} inscritos`,
  };
}
