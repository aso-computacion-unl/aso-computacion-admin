import type { EventDatePrecision } from "@/domain/event";

import { eventSchedule } from "./event-schedule";

/** The slice of an event the calendar file reads. Nothing in it is personal data. */
export interface IcsEvent {
  slug: string;
  title: string;
  description: string | null;
  date: string | null;
  datePrecision: EventDatePrecision;
  hora: string | null;
  lugar: string | null;
  updatedAt: Date;
}

const LINE_LIMIT_OCTETS = 75;
const encoder = new TextEncoder();

/** RFC 5545 TEXT: backslash, semicolon and comma are escaped, line breaks become `\n`, other control characters go. */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "");
}

/** Folds a line at 75 octets, never inside a character: each continuation line starts with one space. */
function fold(line: string): string[] {
  const parts: string[] = [];
  let current = "";
  let octets = 0;

  for (const character of line) {
    const size = encoder.encode(character).length;

    if (octets + size > LINE_LIMIT_OCTETS) {
      parts.push(current);
      current = " ";
      octets = 1;
    }

    current += character;
    octets += size;
  }

  return [...parts, current];
}

const utcStamp = (date: Date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

function nextDay(date: string): string {
  const [year, month, day] = date.split("-").map(Number) as [number, number, number];

  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10).replaceAll("-", "");
}

/**
 * The `.ics` file for one public event, or null when it has no exact day. Public and the same for everyone:
 * it holds the event's own data only, never who registered. Times are written in UTC (Ecuador has no
 * daylight saving, so no VTIMEZONE is needed). `url` is the registration page, when this admin hosts one.
 */
export function buildEventIcs(event: IcsEvent, { url }: { url: string | null }): string | null {
  const schedule = eventSchedule(event.date, event.datePrecision, event.hora);

  if (!schedule) {
    return null;
  }

  const day = schedule.startLocal.slice(0, 10).replaceAll("-", "");
  const when = schedule.allDay
    ? [`DTSTART;VALUE=DATE:${day}`, `DTEND;VALUE=DATE:${nextDay(schedule.startLocal)}`]
    : [`DTSTART:${utcStamp(schedule.startUtc!)}`, ...(schedule.endUtc ? [`DTEND:${utcStamp(schedule.endUtc)}`] : [])];

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ASO Computación//Eventos//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.slug}@aso-computacion`,
    `DTSTAMP:${utcStamp(event.updatedAt)}`,
    ...when,
    `SUMMARY:${escapeText(event.title)}`,
    ...(event.description ? [`DESCRIPTION:${escapeText(event.description)}`] : []),
    ...(event.lugar ? [`LOCATION:${escapeText(event.lugar)}`] : []),
    ...(url ? [`URL:${url}`] : []),
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return `${lines.flatMap(fold).join("\r\n")}\r\n`;
}
