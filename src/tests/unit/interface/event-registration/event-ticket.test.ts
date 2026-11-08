import { describe, expect, it } from "vitest";

import { deadlineLabel, seatsOf, ticketDate } from "@/interface/event-registration/event-ticket";

describe("the date on the ticket's stub", () => {
  it("names the weekday, the day and the month for an exact day", () => {
    expect(ticketDate("2026-11-28", "day")).toEqual({ weekday: "Sáb", main: "28", sub: "nov 2026", label: "sáb 28 nov 2026", iso: "2026-11-28" });
    expect(ticketDate("2026-12-01")).toMatchObject({ weekday: "Mar", main: "1", sub: "dic 2026" });
  });

  it("shows only the month when the event has no exact day", () => {
    expect(ticketDate("2026-11-01", "month")).toEqual({ weekday: null, main: "nov", sub: "2026", label: "nov 2026", iso: "2026-11" });
  });

  it("says the date is pending instead of inventing one", () => {
    expect(ticketDate(null)).toEqual({ weekday: null, main: "—", sub: "por definir", label: "Fecha por definir", iso: null });
  });
});

describe("the registration deadline", () => {
  it("is said in Ecuador's time, whatever the server's zone", () => {
    expect(deadlineLabel(new Date("2026-11-18T23:00:00Z"))).toBe("18 nov 2026, 18:00");
    // 03:30 UTC is still the evening before in Ecuador (UTC-5).
    expect(deadlineLabel(new Date("2026-11-19T03:30:00Z"))).toBe("18 nov 2026, 22:30");
  });
});

describe("the seats on the ticket", () => {
  it("counts what is left and how much of the meter is filled", () => {
    expect(seatsOf({ capacity: 40, registered: 32 })).toEqual({ left: "Quedan 8 cupos", filled: 80, summary: "32 de 40 inscritos" });
    expect(seatsOf({ capacity: 40, registered: 39 })).toMatchObject({ left: "Queda 1 cupo" });
  });

  it("never goes below zero or above a full meter", () => {
    expect(seatsOf({ capacity: 2, registered: 2 })).toEqual({ left: "Quedan 0 cupos", filled: 100, summary: "2 de 2 inscritos" });
    expect(seatsOf({ capacity: 2, registered: 5 })).toMatchObject({ left: "Quedan 0 cupos", filled: 100 });
  });

  it("has nothing to say when the event has no limit", () => {
    expect(seatsOf({ capacity: null, registered: 48 })).toBeNull();
  });
});
