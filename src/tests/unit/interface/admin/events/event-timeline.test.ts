import { describe, expect, it } from "vitest";

import { formatEventDate, groupEvents, todayInLoja } from "@/interface/admin/events/event-timeline";

interface Item {
  id: string;
  date: string | null;
  isPublished: boolean;
  updatedAt: Date;
}

const item = (id: string, date: string | null, isPublished: boolean, updatedAt = "2026-10-01T00:00:00Z"): Item => ({
  id,
  date,
  isPublished,
  updatedAt: new Date(updatedAt),
});
const ids = (items: Item[]) => items.map((entry) => entry.id);

describe("todayInLoja", () => {
  it("is the calendar date in Ecuador (UTC-5), not in UTC", () => {
    // 01:30 UTC on the 23rd is still the 22nd in Loja.
    expect(todayInLoja(new Date("2026-10-23T01:30:00Z"))).toBe("2026-10-22");
    expect(todayInLoja(new Date("2026-10-23T05:00:00Z"))).toBe("2026-10-23");
  });
});

describe("groupEvents", () => {
  const today = "2026-10-22";

  it("puts unpublished events in drafts, most recently edited first, whatever their date", () => {
    const grouped = groupEvents(
      [item("old", "2026-12-01", false, "2026-09-01T00:00:00Z"), item("new", null, false, "2026-10-20T00:00:00Z")],
      today,
    );

    expect(ids(grouped.drafts)).toEqual(["new", "old"]);
    expect(grouped.upcoming).toEqual([]);
    expect(grouped.past).toEqual([]);
  });

  it("splits published events at today: today and later are upcoming, earlier are past", () => {
    const grouped = groupEvents(
      [item("yesterday", "2026-10-21", true), item("today", "2026-10-22", true), item("tomorrow", "2026-10-23", true)],
      today,
    );

    expect(ids(grouped.upcoming)).toEqual(["tomorrow", "today"]);
    expect(ids(grouped.past)).toEqual(["yesterday"]);
  });

  it("orders both groups newest date first, so the nearest events sit next to HEAD", () => {
    const grouped = groupEvents(
      [
        item("p1", "2026-01-10", true),
        item("p2", "2026-09-30", true),
        item("u1", "2026-11-30", true),
        item("u2", "2026-10-25", true),
      ],
      today,
    );

    expect(ids(grouped.upcoming)).toEqual(["u1", "u2"]);
    expect(ids(grouped.past)).toEqual(["p2", "p1"]);
  });

  it("puts a published event without a date last in the past group", () => {
    const grouped = groupEvents([item("none", null, true), item("dated", "2026-01-01", true)], today);

    expect(ids(grouped.past)).toEqual(["dated", "none"]);
  });

  it("keeps the input order of events on the same date and does not mutate the input", () => {
    const input = [item("a", "2026-05-05", true), item("b", "2026-05-05", true)];
    const copy = [...input];

    expect(ids(groupEvents(input, today).past)).toEqual(["a", "b"]);
    expect(input).toEqual(copy);
  });
});

describe("formatEventDate", () => {
  it("writes a calendar date as day, short Spanish month and year", () => {
    expect(formatEventDate("2026-10-22")).toBe("22 oct 2026");
    expect(formatEventDate("2026-01-05")).toBe("5 ene 2026");
    expect(formatEventDate("2025-12-31")).toBe("31 dic 2025");
  });

  it("says so when the event has no date, and does not choke on a malformed one", () => {
    expect(formatEventDate(null)).toBe("Sin fecha");
    expect(formatEventDate("pronto")).toBe("pronto");
  });
});
