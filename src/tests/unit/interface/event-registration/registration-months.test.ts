import { describe, expect, it } from "vitest";

import { eventsCountText, groupByMonth, showingText } from "@/interface/event-registration/registration-months";

const event = (title: string, date: string | null) => ({ title, date });

describe("groupByMonth (S5): the public list split under a heading per month", () => {
  it("keeps the order it is given and names each month in full, without the year while the list stays in one year", () => {
    const groups = groupByMonth([event("a", "2026-11-14"), event("b", "2026-11-21"), event("c", "2026-12-02")]);

    expect(groups.map(({ key, heading, name, ofMonth }) => ({ key, heading, name, ofMonth }))).toEqual([
      { key: "2026-11", heading: "Noviembre", name: "Noviembre", ofMonth: "noviembre" },
      { key: "2026-12", heading: "Diciembre", name: "Diciembre", ofMonth: "diciembre" },
    ]);
    expect(groups[0]!.events.map((item) => item.title)).toEqual(["a", "b"]);
  });

  it("adds the year to every month once the list spans more than one year", () => {
    const groups = groupByMonth([event("a", "2026-12-18"), event("b", "2027-01-16")]);

    expect(groups.map((group) => [group.heading, group.name, group.ofMonth])).toEqual([
      ["Diciembre 2026", "Diciembre 2026", "diciembre de 2026"],
      ["Enero 2027", "Enero 2027", "enero de 2027"],
    ]);
  });

  it("puts the undated events last under their own heading, which is not a month to filter by", () => {
    const groups = groupByMonth([event("a", "2026-11-14"), event("b", null)]);

    expect(groups.at(-1)).toMatchObject({ key: "undated", heading: "Fecha por definir", name: null, ofMonth: null });
    expect(groups.at(-1)!.events.map((item) => item.title)).toEqual(["b"]);
  });

  it("gives nothing for no events", () => {
    expect(groupByMonth([])).toEqual([]);
  });
});

describe("the month filter's words (S4)", () => {
  it("counts the events of a stub, in the singular for one", () => {
    expect(eventsCountText(4)).toBe("4 eventos");
    expect(eventsCountText(1)).toBe("1 evento");
  });

  it("says what the list shows: all of them, or the events of one month", () => {
    expect(showingText(10, null)).toBe("Mostrando los 10 eventos");
    expect(showingText(4, "noviembre")).toBe("Mostrando 4 eventos de noviembre");
    expect(showingText(1, "enero")).toBe("Mostrando 1 evento de enero");
  });
});
