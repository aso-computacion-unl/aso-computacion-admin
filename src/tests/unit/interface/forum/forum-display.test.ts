import { describe, expect, it } from "vitest";

import { CATEGORY_HUES, categoryHue, formatAbsoluteTime, formatRelativeTime, initialsOf, parsePageParam, parseThreadFilter, threadStatus } from "@/interface/forum/forum-display";

const NOW = new Date("2026-10-26T15:00:00Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms);
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe("formatRelativeTime", () => {
  it.each([
    [0, "hace un momento"],
    [45_000, "hace un momento"],
    [MINUTE, "hace 1 min"],
    [12 * MINUTE, "hace 12 min"],
    [59 * MINUTE, "hace 59 min"],
    [HOUR, "hace 1 h"],
    [23 * HOUR, "hace 23 h"],
    [DAY, "ayer"],
    [47 * HOUR, "ayer"],
    [2 * DAY, "hace 2 d"],
    [29 * DAY, "hace 29 d"],
  ])("says how long ago for %i ms", (elapsed, expected) => {
    expect(formatRelativeTime(ago(elapsed), NOW)).toBe(expected);
  });

  it("falls back to the date, in Ecuador's time zone, after a month", () => {
    expect(formatRelativeTime(new Date("2026-08-01T03:00:00Z"), NOW)).toBe("31 jul 2026");
  });

  it("treats a date slightly in the future (clock skew) as just now", () => {
    expect(formatRelativeTime(new Date(NOW.getTime() + 5 * MINUTE), NOW)).toBe("hace un momento");
  });
});

describe("formatAbsoluteTime", () => {
  it("writes the full date and time in Ecuador's time zone", () => {
    expect(formatAbsoluteTime(new Date("2026-10-26T15:30:00Z"))).toBe("26 oct 2026, 10:30");
  });
});

describe("initialsOf", () => {
  it.each([
    ["Daniela P.", "DP"],
    ["Mateo", "M"],
    ["  ana   maría lópez ", "AM"],
    ["", "?"],
  ])("%j -> %j", (name, expected) => {
    expect(initialsOf(name)).toBe(expected);
  });
});

describe("threadStatus", () => {
  it("is solved when there is a best answer, even if the thread is locked", () => {
    expect(threadStatus({ hasBestAnswer: true, locked: true })).toBe("solved");
    expect(threadStatus({ hasBestAnswer: true, locked: false })).toBe("solved");
  });

  it("is locked when closed without a best answer, and open otherwise", () => {
    expect(threadStatus({ hasBestAnswer: false, locked: true })).toBe("locked");
    expect(threadStatus({ hasBestAnswer: false, locked: false })).toBe("open");
  });
});

describe("parseThreadFilter", () => {
  it("only accepts the two known filters and defaults to open", () => {
    expect(parseThreadFilter("resueltos")).toBe("solved");
    expect(parseThreadFilter("abiertos")).toBe("open");
    expect(parseThreadFilter(undefined)).toBe("open");
    expect(parseThreadFilter(["resueltos"])).toBe("open");
    expect(parseThreadFilter("<script>")).toBe("open");
  });
});

describe("parsePageParam", () => {
  it.each([
    [undefined, 1],
    ["3", 3],
    ["0", 1],
    ["-2", 1],
    ["2.5", 1],
    ["abc", 1],
    [["4"], 1],
    ["99999999999999999999", 1],
  ])("%j -> %i", (raw, expected) => {
    expect(parsePageParam(raw)).toBe(expected);
  });
});

describe("categoryHue", () => {
  it("gives the three seeded categories distinct fixed slots", () => {
    const slots = ["general", "materias", "propuestas"].map(categoryHue);

    expect(new Set(slots).size).toBe(3);
  });

  it("gives any other category a stable slot inside the palette", () => {
    for (const slug of ["eventos", "proyectos", "x", "una-categoria-con-un-nombre-largo"]) {
      expect(categoryHue(slug)).toBe(categoryHue(slug));
      expect(categoryHue(slug)).toBeGreaterThanOrEqual(0);
      expect(categoryHue(slug)).toBeLessThan(CATEGORY_HUES);
    }
  });
});
