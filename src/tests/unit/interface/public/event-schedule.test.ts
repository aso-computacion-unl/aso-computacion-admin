import { describe, expect, it } from "vitest";

import { eventSchedule } from "@/interface/public/event-schedule";

describe("eventSchedule", () => {
  it("reads a start and an end time out of the free-text hora, in Ecuador time", () => {
    expect(eventSchedule("2026-11-28", "day", "09:00 - 11:30")).toEqual({
      allDay: false,
      startLocal: "2026-11-28T09:00:00-05:00",
      endLocal: "2026-11-28T11:30:00-05:00",
      startUtc: new Date("2026-11-28T14:00:00.000Z"),
      endUtc: new Date("2026-11-28T16:30:00.000Z"),
    });
  });

  it.each([
    ["14:30", "2026-11-28T14:30:00-05:00", null],
    ["9:05", "2026-11-28T09:05:00-05:00", null],
    ["14h30", "2026-11-28T14:30:00-05:00", null],
    ["a las 8h", "2026-11-28T08:00:00-05:00", null],
    ["08:00–10:00 h", "2026-11-28T08:00:00-05:00", "2026-11-28T10:00:00-05:00"],
    ["de 15:00 a 17:00", "2026-11-28T15:00:00-05:00", "2026-11-28T17:00:00-05:00"],
  ])("understands %j", (hora, startLocal, endLocal) => {
    expect(eventSchedule("2026-11-28", "day", hora)).toMatchObject({ allDay: false, startLocal, endLocal });
  });

  it("falls back to an all-day event when there is no hora or none can be read", () => {
    for (const hora of [null, "", "por confirmar", "25:00", "12:75", "tarde"]) {
      expect(eventSchedule("2026-11-28", "day", hora), String(hora)).toEqual({ allDay: true, startLocal: "2026-11-28", endLocal: null, startUtc: null, endUtc: null });
    }
  });

  it("ignores an end that is not after the start", () => {
    expect(eventSchedule("2026-11-28", "day", "10:00 - 09:00")).toMatchObject({ allDay: false, endLocal: null, endUtc: null });
    expect(eventSchedule("2026-11-28", "day", "10:00 - 10:00")).toMatchObject({ endLocal: null });
  });

  it("is null without a date or when only the month is known", () => {
    expect(eventSchedule(null, "day", "09:00")).toBeNull();
    expect(eventSchedule("2026-11-01", "month", "09:00")).toBeNull();
  });
});
