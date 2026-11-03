import { describe, expect, it } from "vitest";

import { ValidationError } from "@/domain";
import { formatEcuadorDateTime, parseEcuadorDateTime } from "@/domain/calendar-date";
import { Event } from "@/domain/event";
import { NewsItem } from "@/domain/news-item";
import { assertPublicationWindow, crossedWindowBetween, isPubliclyVisible, publicationState } from "@/domain/publication-window";

const OPEN = new Date("2026-11-02T13:00:00.000Z");
const CLOSE = new Date("2026-11-09T13:00:00.000Z");
const at = (base: Date, offsetMs: number) => new Date(base.getTime() + offsetMs);
const published = { isPublished: true, publishAt: OPEN, unpublishAt: CLOSE };

describe("publicationState", () => {
  it("opens the window at publishAt itself: one millisecond earlier it is scheduled, at that instant it is live", () => {
    expect(publicationState(published, at(OPEN, -1))).toBe("scheduled");
    expect(publicationState(published, OPEN)).toBe("live");
  });

  it("closes the window at unpublishAt itself: one millisecond earlier it is live, at that instant it is expired", () => {
    expect(publicationState(published, at(CLOSE, -1))).toBe("live");
    expect(publicationState(published, CLOSE)).toBe("expired");
  });

  it("is a draft whatever the window says while it is not published", () => {
    for (const now of [at(OPEN, -1), OPEN, CLOSE, at(CLOSE, 1)]) {
      expect(publicationState({ ...published, isPublished: false }, now)).toBe("draft");
    }
  });

  it("treats a missing end as open: no publishAt is live from the start, no unpublishAt never expires", () => {
    expect(publicationState({ isPublished: true, publishAt: null, unpublishAt: CLOSE }, at(CLOSE, -1))).toBe("live");
    expect(publicationState({ isPublished: true, publishAt: OPEN, unpublishAt: null }, new Date("2999-01-01T00:00:00Z"))).toBe("live");
    expect(publicationState({ isPublished: true, publishAt: null, unpublishAt: null }, OPEN)).toBe("live");
  });

  it("is visible to the public only while live", () => {
    expect(isPubliclyVisible(published, OPEN)).toBe(true);
    expect(isPubliclyVisible(published, at(OPEN, -1))).toBe(false);
    expect(isPubliclyVisible(published, CLOSE)).toBe(false);
    expect(isPubliclyVisible({ ...published, isPublished: false }, OPEN)).toBe(false);
  });
});

describe("crossedWindowBetween", () => {
  const SINCE = new Date("2026-11-02T12:00:00.000Z");
  const NOW = new Date("2026-11-02T14:00:00.000Z");

  it("counts a boundary in (since, now]: excluded at since, included at now", () => {
    expect(crossedWindowBetween({ ...published, publishAt: SINCE, unpublishAt: null }, SINCE, NOW)).toBe(false);
    expect(crossedWindowBetween({ ...published, publishAt: NOW, unpublishAt: null }, SINCE, NOW)).toBe(true);
    expect(crossedWindowBetween({ ...published, publishAt: at(NOW, 1), unpublishAt: null }, SINCE, NOW)).toBe(false);
  });

  it("counts an unpublishAt crossing as well", () => {
    expect(crossedWindowBetween({ ...published, publishAt: null, unpublishAt: at(SINCE, 1) }, SINCE, NOW)).toBe(true);
  });

  it("ignores drafts and items without a window", () => {
    expect(crossedWindowBetween({ isPublished: false, publishAt: at(SINCE, 1), unpublishAt: null }, SINCE, NOW)).toBe(false);
    expect(crossedWindowBetween({ isPublished: true, publishAt: null, unpublishAt: null }, SINCE, NOW)).toBe(false);
  });

  it("with no previous build every boundary up to now counts", () => {
    expect(crossedWindowBetween({ ...published, publishAt: new Date("2020-01-01T00:00:00Z"), unpublishAt: null }, null, NOW)).toBe(true);
  });
});

describe("assertPublicationWindow", () => {
  it("accepts open ends and a window that closes after it opens", () => {
    expect(assertPublicationWindow(null, null)).toEqual({ publishAt: null, unpublishAt: null });
    expect(assertPublicationWindow(OPEN, null)).toEqual({ publishAt: OPEN, unpublishAt: null });
    expect(assertPublicationWindow(null, CLOSE)).toEqual({ publishAt: null, unpublishAt: CLOSE });
    expect(assertPublicationWindow(OPEN, CLOSE)).toEqual({ publishAt: OPEN, unpublishAt: CLOSE });
  });

  it("refuses a window that closes at or before it opens, naming unpublishAt", () => {
    for (const close of [OPEN, at(OPEN, -1)]) {
      expect(() => assertPublicationWindow(OPEN, close)).toThrow(ValidationError);
      expect(() => assertPublicationWindow(OPEN, close)).toThrow(expect.objectContaining({ field: "unpublishAt" }));
    }
  });

  it("refuses an invalid date", () => {
    expect(() => assertPublicationWindow(new Date("nope"), null)).toThrow(expect.objectContaining({ field: "publishAt" }));
  });
});

describe("Ecuador date-times (America/Guayaquil, UTC-5 all year)", () => {
  it("reads a local date-time as five hours behind UTC", () => {
    expect(parseEcuadorDateTime("publishAt", "2026-11-02T08:00").toISOString()).toBe("2026-11-02T13:00:00.000Z");
  });

  it("rolls the UTC day over when the local evening is already the next UTC day", () => {
    expect(parseEcuadorDateTime("publishAt", "2026-11-02T20:30").toISOString()).toBe("2026-11-03T01:30:00.000Z");
  });

  it("formats an instant back to the local date-time the editor typed, whatever the server time zone", () => {
    expect(formatEcuadorDateTime(new Date("2026-11-03T01:30:00.000Z"))).toBe("2026-11-02T20:30");
    expect(formatEcuadorDateTime(parseEcuadorDateTime("publishAt", "2026-02-28T23:59"))).toBe("2026-02-28T23:59");
  });

  it("refuses anything that is not a real local date-time", () => {
    for (const value of ["", "2026-11-02", "2026-11-02 08:00", "2026-13-02T08:00", "2026-02-30T08:00", "2026-11-02T24:00", "2026-11-02T08:60"]) {
      expect(() => parseEcuadorDateTime("publishAt", value), value).toThrow(expect.objectContaining({ field: "publishAt" }));
    }
  });
});

describe("Event and NewsItem windows", () => {
  const news = { title: "Noticia", summary: "Resumen", body: "Cuerpo" };

  it("default to no window", () => {
    expect(Event.create({ title: "Taller" }).props).toMatchObject({ publishAt: null, unpublishAt: null });
    expect(NewsItem.create(news).props).toMatchObject({ publishAt: null, unpublishAt: null });
  });

  it("keep the window they are created with and refuse an inverted one", () => {
    expect(Event.create({ title: "Taller", publishAt: OPEN, unpublishAt: CLOSE }).props).toMatchObject({ publishAt: OPEN, unpublishAt: CLOSE });
    expect(NewsItem.create({ ...news, publishAt: OPEN, unpublishAt: CLOSE }).props).toMatchObject({ publishAt: OPEN, unpublishAt: CLOSE });
    expect(() => Event.create({ title: "Taller", publishAt: CLOSE, unpublishAt: OPEN })).toThrow(ValidationError);
    expect(() => NewsItem.create({ ...news, publishAt: CLOSE, unpublishAt: OPEN })).toThrow(ValidationError);
  });

  it("update keeps the window when it is left out, replaces it, and clears an end with null", () => {
    const event = Event.create({ title: "Taller", publishAt: OPEN, unpublishAt: CLOSE });

    expect(event.update({ title: "Otro" }).props).toMatchObject({ publishAt: OPEN, unpublishAt: CLOSE });
    expect(event.update({ unpublishAt: null }).props).toMatchObject({ publishAt: OPEN, unpublishAt: null });
    expect(() => event.update({ publishAt: at(CLOSE, 1) })).toThrow(expect.objectContaining({ field: "unpublishAt" }));

    const item = NewsItem.create({ ...news, publishAt: OPEN, unpublishAt: CLOSE });

    expect(item.update({ title: "Otro" }).props).toMatchObject({ publishAt: OPEN, unpublishAt: CLOSE });
    expect(item.update({ publishAt: null, unpublishAt: null }).props).toMatchObject({ publishAt: null, unpublishAt: null });
    expect(item.withPublished(true).props).toMatchObject({ publishAt: OPEN, unpublishAt: CLOSE });
  });
});
