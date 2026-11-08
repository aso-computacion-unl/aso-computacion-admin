import { describe, expect, it } from "vitest";

import type { PublicContentSnapshot } from "@/application/dto/public-content.dto";
import { toPublicContentResponse } from "@/interface/public/public-content.mapper";

const AT = new Date("2026-10-22T16:00:00.000Z");
const ORIGIN = "https://admin.example";

const baseEvent = {
  id: "event-1",
  slug: "hackaton",
  title: "Hackatón",
  description: "Un día de código",
  date: "2026-11-28",
  datePrecision: "day" as const,
  type: "evento" as const,
  commitMessage: "feat: hackatón",
  hora: "09:00 - 17:00",
  lugar: "Lab 2",
  para: "todos",
  featured: true,
  linkUrl: "https://aso.test/h",
  linkLabel: "Más información",
  highlights: ["Apertura"],
  isPublished: true,
  publishAt: null,
  unpublishAt: null,
  registrationMode: "none" as const,
  registrationCapacity: null,
  registrationDeadline: null,
  createdAt: AT,
  updatedAt: AT,
  photos: [],
};

type Overrides = Partial<PublicContentSnapshot["events"][number]>;

const snapshot = (overrides: Overrides = {}): PublicContentSnapshot => ({
  events: [{ ...baseEvent, ...overrides }],
  faqs: [],
  pillars: [],
  socials: [],
  board: [],
  settings: null,
  news: [],
  commands: [],
});

const event = (overrides: Overrides = {}, origin: string | null = ORIGIN) =>
  toPublicContentResponse(snapshot(overrides), AT, { adminOrigin: origin ?? undefined }).events[0]!;

// The event shape the landing already consumes, before registrations existed (S6).
const PREVIOUS_KEYS = ["commitMessage", "date", "datePrecision", "description", "featured", "highlights", "hora", "linkLabel", "linkUrl", "lugar", "para", "photos", "slug", "title", "type"];

describe("public API: event registration, calendar and structured data (additive)", () => {
  it("keeps every previous event key with the same value; the only change is three new keys", () => {
    const current = event();
    const withoutRegistration = toPublicContentResponse(snapshot(), AT).events[0]!;

    expect(Object.keys(current).sort()).toEqual([...PREVIOUS_KEYS, "calendarUrl", "registration", "structuredData"].sort());
    expect(Object.fromEntries(PREVIOUS_KEYS.map((key) => [key, current[key as keyof typeof current]]))).toEqual({
      commitMessage: "feat: hackatón",
      date: "2026-11-28",
      datePrecision: "day",
      description: "Un día de código",
      featured: true,
      highlights: ["Apertura"],
      hora: "09:00 - 17:00",
      linkLabel: "Más información",
      linkUrl: "https://aso.test/h",
      lugar: "Lab 2",
      para: "todos",
      photos: [],
      slug: "hackaton",
      title: "Hackatón",
      type: "evento",
    });
    expect(Object.fromEntries(PREVIOUS_KEYS.map((key) => [key, withoutRegistration[key as keyof typeof withoutRegistration]]))).toEqual(
      Object.fromEntries(PREVIOUS_KEYS.map((key) => [key, current[key as keyof typeof current]])),
    );
  });

  it("has no registration for an event that takes none", () => {
    expect(event().registration).toBeNull();
  });

  it("describes a UNL-account registration: the page on this admin, no endpoint", () => {
    expect(event({ registrationMode: "unl", registrationCapacity: 40, registrationDeadline: new Date("2026-11-27T23:00:00.000Z") }).registration).toEqual({
      mode: "unl",
      capacity: 40,
      deadline: "2026-11-27T23:00:00.000Z",
      url: `${ORIGIN}/inscripciones/hackaton`,
      endpoint: null,
    });
  });

  it("describes an open-form registration: the endpoint to POST to, and no page on this admin", () => {
    expect(event({ registrationMode: "open" }).registration).toEqual({
      mode: "open",
      capacity: null,
      deadline: null,
      url: null,
      endpoint: `${ORIGIN}/api/public/events/hackaton/registrations`,
    });
  });

  it("gives the structured data the landing needs for a schema.org Event, with the registration link only when this admin hosts it", () => {
    expect(event().structuredData).toEqual({ startDate: "2026-11-28T09:00:00-05:00", endDate: "2026-11-28T17:00:00-05:00", location: "Lab 2", registrationUrl: null });
    expect(event({ registrationMode: "unl" }).structuredData?.registrationUrl).toBe(`${ORIGIN}/inscripciones/hackaton`);
    expect(event({ hora: null, lugar: null }).structuredData).toEqual({ startDate: "2026-11-28", endDate: null, location: null, registrationUrl: null });
  });

  it("links the calendar file for an event with an exact day, and none for a month-only or undated one", () => {
    expect(event().calendarUrl).toBe(`${ORIGIN}/api/public/events/hackaton/calendar.ics`);
    expect(event({ datePrecision: "month", date: "2026-11-01" })).toMatchObject({ calendarUrl: null, structuredData: null });
    expect(event({ date: null })).toMatchObject({ calendarUrl: null, structuredData: null });
  });

  it("leaves every URL null when the admin's public origin is not configured", () => {
    const unconfigured = event({ registrationMode: "open" }, null);

    expect(unconfigured.calendarUrl).toBeNull();
    expect(unconfigured.registration).toMatchObject({ mode: "open", url: null, endpoint: null });
  });

  it("exposes no id, no timestamp and no registrant data", () => {
    const text = JSON.stringify(event({ registrationMode: "unl", registrationCapacity: 3 }));

    expect(text).not.toMatch(/event-1|createdAt|updatedAt|isPublished|"id"|@unl|count|registered/);
  });
});
