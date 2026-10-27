import { describe, expect, it } from "vitest";

import { formatClock, formatStamp, groupByDay, shortId } from "@/interface/admin/day-groups";

// 10:00 in Ecuador (UTC-5).
const NOW = new Date("2026-10-27T15:00:00Z");

describe("grouping entries by day", () => {
  it("groups consecutive entries by their day in Ecuador, keeping their order, and names today and yesterday", () => {
    const entries = [
      { id: "a", at: new Date("2026-10-27T14:00:00Z") },
      { id: "b", at: new Date("2026-10-27T05:30:00Z") },
      // 23:30 on the 26th in Ecuador, though already the 27th in UTC.
      { id: "c", at: new Date("2026-10-27T04:30:00Z") },
      { id: "d", at: new Date("2026-10-20T18:00:00Z") },
    ];

    const groups = groupByDay(entries, (entry) => entry.at, NOW);

    expect(groups.map((group) => [group.key, group.label, group.items.map((item) => item.id)])).toEqual([
      ["2026-10-27", "Hoy", ["a", "b"]],
      ["2026-10-26", "Ayer", ["c"]],
      ["2026-10-20", "martes, 20 de octubre de 2026", ["d"]],
    ]);
  });

  it("returns no groups for no entries", () => {
    expect(groupByDay([], () => NOW, NOW)).toEqual([]);
  });
});

describe("the compact time formats", () => {
  it("writes the clock in 24 hours, so no 'a. m.' can wrap", () => {
    expect(formatClock(new Date("2026-10-27T14:05:09Z"))).toBe("09:05");
    expect(formatClock(new Date("2026-10-27T23:40:00Z"))).toBe("18:40");
  });

  it("writes a stamp as 'hoy', 'ayer' or the short date, plus the clock", () => {
    expect(formatStamp(new Date("2026-10-27T14:05:00Z"), NOW)).toBe("hoy 09:05");
    expect(formatStamp(new Date("2026-10-26T14:05:00Z"), NOW)).toBe("ayer 09:05");
    expect(formatStamp(new Date("2026-11-03T14:05:00Z"), NOW)).toBe("3 nov 2026 09:05");
  });

  it("shortens an identifier to its first eight characters", () => {
    expect(shortId("3f2a9c1e-7b44-4d2a-9a51-0c6e2f1b8d77")).toBe("3f2a9c1e");
    expect(shortId("faq-12")).toBe("faq-12");
  });
});
