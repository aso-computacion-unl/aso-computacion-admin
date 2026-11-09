import { describe, expect, it } from "vitest";

import { REMINDER_DAYS_AHEAD_MAX, REMINDER_DAYS_AHEAD_MIN, isInReminderWindow, reminderWindow } from "@/domain/registration-reminder";

describe("the reminder window", () => {
  it("is one to three days ahead", () => {
    expect([REMINDER_DAYS_AHEAD_MIN, REMINDER_DAYS_AHEAD_MAX]).toEqual([1, 3]);
  });

  it("starts tomorrow and ends in three days, counted in Ecuador", () => {
    expect(reminderWindow(new Date("2026-11-20T11:00:00.000Z"))).toEqual({ from: "2026-11-21", to: "2026-11-23" });
  });

  it("follows the Ecuador day, not the UTC one, at both edges of the day", () => {
    // 04:59 UTC is still the 19th in Ecuador; 05:00 UTC is the 20th.
    expect(reminderWindow(new Date("2026-11-20T04:59:59.999Z"))).toEqual({ from: "2026-11-20", to: "2026-11-22" });
    expect(reminderWindow(new Date("2026-11-20T05:00:00.000Z"))).toEqual({ from: "2026-11-21", to: "2026-11-23" });
  });

  it("crosses a month and a year", () => {
    expect(reminderWindow(new Date("2026-11-29T11:00:00.000Z"))).toEqual({ from: "2026-11-30", to: "2026-12-02" });
    expect(reminderWindow(new Date("2026-12-30T11:00:00.000Z"))).toEqual({ from: "2026-12-31", to: "2027-01-02" });
    expect(reminderWindow(new Date("2028-02-27T11:00:00.000Z"))).toEqual({ from: "2028-02-28", to: "2028-03-01" });
  });

  it("includes both ends and excludes today, yesterday and day four", () => {
    const now = new Date("2026-11-20T11:00:00.000Z");

    expect(["2026-11-19", "2026-11-20", "2026-11-21", "2026-11-22", "2026-11-23", "2026-11-24"].map((day) => isInReminderWindow(day, now))).toEqual([false, false, true, true, true, false]);
  });

  it("has no window for an event without an exact day", () => {
    expect(isInReminderWindow(null, new Date("2026-11-20T11:00:00.000Z"))).toBe(false);
  });
});
