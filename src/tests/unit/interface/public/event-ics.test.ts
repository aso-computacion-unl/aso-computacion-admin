import { describe, expect, it } from "vitest";

import { buildEventIcs, type IcsEvent } from "@/interface/public/event-ics";

const event = (overrides: Partial<IcsEvent> = {}): IcsEvent => ({
  slug: "taller-de-git",
  title: "Taller de Git",
  description: "Aprenda ramas, commits y merges.",
  date: "2026-11-28",
  datePrecision: "day",
  hora: "09:00 - 11:00",
  lugar: "Laboratorio 2",
  updatedAt: new Date("2026-11-01T12:00:00.000Z"),
  ...overrides,
});

const unfolded = (ics: string) => ics.replace(/\r\n[ \t]/g, "").split("\r\n");

describe("buildEventIcs", () => {
  it("is a calendar with one event, CRLF line ends and the zone-independent UTC times of an Ecuador event", () => {
    const ics = buildEventIcs(event(), { url: null })!;
    const lines = unfolded(ics);

    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).not.toMatch(/[^\r]\n/);
    expect(lines).toEqual(
      expect.arrayContaining([
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//ASO Computación//Eventos//ES",
        "METHOD:PUBLISH",
        "BEGIN:VEVENT",
        "UID:taller-de-git@aso-computacion",
        "DTSTAMP:20261101T120000Z",
        "DTSTART:20261128T140000Z",
        "DTEND:20261128T160000Z",
        "SUMMARY:Taller de Git",
        "DESCRIPTION:Aprenda ramas\\, commits y merges.",
        "LOCATION:Laboratorio 2",
        "STATUS:CONFIRMED",
        "END:VEVENT",
      ]),
    );
    expect(lines.some((line) => line.startsWith("URL:"))).toBe(false);
  });

  it("is an all-day event (DTEND the next day) when the hora cannot be read", () => {
    const lines = unfolded(buildEventIcs(event({ hora: null }), { url: null })!);

    expect(lines).toEqual(expect.arrayContaining(["DTSTART;VALUE=DATE:20261128", "DTEND;VALUE=DATE:20261129"]));
  });

  it("has no end when only a start time is known, and rolls an all-day end over a month and a year", () => {
    expect(unfolded(buildEventIcs(event({ hora: "14h30" }), { url: null })!).some((line) => line.startsWith("DTEND"))).toBe(false);
    expect(unfolded(buildEventIcs(event({ hora: null, date: "2026-12-31" }), { url: null })!)).toContain("DTEND;VALUE=DATE:20270101");
  });

  it("escapes what the format reserves and folds long lines at 75 octets without splitting a character", () => {
    const ics = buildEventIcs(event({ title: "A; B, C \\ D", description: `Línea uno\nLínea dos ${"ñ".repeat(120)}`, lugar: null }), { url: null })!;

    expect(unfolded(ics)).toEqual(expect.arrayContaining(["SUMMARY:A\\; B\\, C \\\\ D"]));
    expect(unfolded(ics).find((line) => line.startsWith("DESCRIPTION"))).toBe(`DESCRIPTION:Línea uno\\nLínea dos ${"ñ".repeat(120)}`);
    for (const line of ics.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(ics).not.toContain("\uFFFD");
    expect(unfolded(ics).some((line) => line.startsWith("LOCATION"))).toBe(false);
  });

  it("carries the registration link when there is one, and nothing about who registered", () => {
    const ics = buildEventIcs(event(), { url: "https://admin.example/inscripciones/taller-de-git" })!;

    expect(unfolded(ics)).toContain("URL:https://admin.example/inscripciones/taller-de-git");
    expect(ics).not.toMatch(/ATTENDEE|ORGANIZER|@unl\.edu\.ec|mailto:/i);
  });

  it("is null for an event without an exact day", () => {
    expect(buildEventIcs(event({ date: null }), { url: null })).toBeNull();
    expect(buildEventIcs(event({ datePrecision: "month", date: "2026-11-01" }), { url: null })).toBeNull();
  });
});
