import { describe, expect, it } from "vitest";

import { dropResult, placeMessage } from "@/interface/admin/reorder/reorder-drag";

const IDS = ["a", "b", "c", "d"];

describe("dropResult", () => {
  it("drops an item onto a later one: it takes that place and the ones in between shift up", () => {
    expect(dropResult(IDS, "a", "c", 0)).toEqual({ order: ["b", "c", "a", "d"], position: 2 });
  });

  it("drops an item onto an earlier one: it takes that place and the ones in between shift down", () => {
    expect(dropResult(IDS, "d", "b", 0)).toEqual({ order: ["a", "d", "b", "c"], position: 1 });
  });

  it("sends the place in the whole list when the page starts after other items", () => {
    expect(dropResult(IDS, "a", "b", 20)).toEqual({ order: ["b", "a", "c", "d"], position: 21 });
  });

  it("does not change the ids it was given", () => {
    const ids = [...IDS];

    dropResult(ids, "a", "d", 0);

    expect(ids).toEqual(IDS);
  });

  it.each([
    ["on itself", "a", "a"],
    ["outside the list", "a", null],
    ["on nothing", "a", undefined],
    ["on an id the page does not have", "a", "zzz"],
    ["an id the page does not have", "zzz", "a"],
  ])("is null when dropped %s", (_label, active, over) => {
    expect(dropResult(IDS, active, over, 0)).toBeNull();
  });
});

describe("placeMessage", () => {
  it("names the item and its place", () => {
    expect(placeMessage("Taller de Git", 2, 5)).toBe("Taller de Git: posición 2 de 5.");
  });
});
