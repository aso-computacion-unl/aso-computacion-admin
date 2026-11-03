import { describe, expect, it } from "vitest";

import { soonestFirst } from "@/application/event-registration/soonest-first";

const event = (title: string, date: string | null) => ({ title, date });

describe("soonestFirst", () => {
  it("orders by date, the earlier one first", () => {
    expect(soonestFirst(event("A", "2026-11-01"), event("B", "2026-12-01"))).toBeLessThan(0);
    expect(soonestFirst(event("A", "2026-12-01"), event("B", "2026-11-01"))).toBeGreaterThan(0);
  });

  it("puts an undated event after a dated one, whichever side it is on", () => {
    expect(soonestFirst(event("A", null), event("B", "2026-11-01"))).toBeGreaterThan(0);
    expect(soonestFirst(event("A", "2026-11-01"), event("B", null))).toBeLessThan(0);
  });

  it("breaks a tie on the same date, or on none, by title", () => {
    expect(soonestFirst(event("Alfa", "2026-11-01"), event("Beta", "2026-11-01"))).toBeLessThan(0);
    expect(soonestFirst(event("Beta", null), event("Alfa", null))).toBeGreaterThan(0);
  });

  it("sorts a mixed list soonest first with the undated at the end", () => {
    const sorted = [event("Sin fecha", null), event("Tarde", "2026-12-01"), event("Pronto", "2026-11-01")].sort(soonestFirst);

    expect(sorted.map((item) => item.title)).toEqual(["Pronto", "Tarde", "Sin fecha"]);
  });
});
