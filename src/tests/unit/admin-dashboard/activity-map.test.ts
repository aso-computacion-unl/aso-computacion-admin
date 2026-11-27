import { describe, expect, it } from "vitest";

import { activityLabel, activityLevel, summarizeActivity, type ActivityDay } from "../../../../app/admin/_components/activity-map";

/** `length` consecutive days from `start` (YYYY-MM-DD), with the counts given (0 for the rest). */
function days(start: string, length: number, counts: Record<number, number> = {}): ActivityDay[] {
  const first = new Date(`${start}T12:00:00Z`).getTime();

  return Array.from({ length }, (_, index) => ({ date: new Date(first + index * 86_400_000).toISOString().slice(0, 10), count: counts[index] ?? 0 }));
}

describe("activityLevel", () => {
  it("keeps a day without changes, or a map without any, at level 0", () => {
    expect(activityLevel(0, 10)).toBe(0);
    expect(activityLevel(0, 0)).toBe(0);
  });

  it("buckets the rest in four steps relative to the busiest day", () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8].map((count) => activityLevel(count, 8))).toEqual([1, 1, 2, 2, 3, 3, 4, 4]);
  });

  it("never lets a quiet day vanish beside a very busy one", () => {
    expect(activityLevel(1, 500)).toBe(1);
  });
});

describe("summarizeActivity", () => {
  it("adds the total and finds the busiest day, the earliest on a tie", () => {
    const summary = summarizeActivity(days("2026-08-10", 112, { 3: 5, 20: 14, 90: 14 }));

    expect(summary.total).toBe(33);
    expect(summary.busiest).toEqual({ date: "2026-08-30", count: 14 });
  });

  it("lays 16 weeks out Monday first, padding before the oldest day and after the newest", () => {
    // 2026-08-06 is a Thursday: three blanks before it; 112 days end on a Wednesday: four blanks after.
    const { cells } = summarizeActivity(days("2026-08-06", 112));

    expect(cells).toHaveLength(17 * 7);
    expect(cells.slice(0, 3).every((cell) => cell.date === null)).toBe(true);
    expect(cells[3]?.date).toBe("2026-08-06");
    expect(cells.slice(-4).every((cell) => cell.date === null)).toBe(true);
  });

  it("needs no padding when the map starts on a Monday", () => {
    const { cells } = summarizeActivity(days("2026-08-10", 112));

    expect(cells).toHaveLength(112);
    expect(cells.every((cell) => cell.date !== null)).toBe(true);
  });

  it("handles an empty map", () => {
    expect(summarizeActivity([])).toEqual({ total: 0, busiest: null, cells: [] });
  });
});

describe("activityLabel", () => {
  it("says the total and the busiest day for the team", () => {
    expect(activityLabel({ total: 214, busiest: { date: "2026-11-17", count: 14 } }, false)).toBe(
      "Actividad del equipo en las últimas 16 semanas: 214 cambios, el día más activo fue el martes 17 de noviembre con 14.",
    );
  });

  it("speaks of the editor's own changes, and of none", () => {
    expect(activityLabel({ total: 0, busiest: null }, true)).toBe("Tus cambios en las últimas 16 semanas: sin cambios.");
  });
});
