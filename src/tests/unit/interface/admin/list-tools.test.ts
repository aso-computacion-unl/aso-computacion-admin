import { describe, expect, it } from "vitest";

import { LIST_TOOLS_MIN_ROWS, showListTools } from "@/interface/admin/list-params";

describe("showListTools", () => {
  it("hides the select-all bar and the search on a list shorter than five rows", () => {
    expect(LIST_TOOLS_MIN_ROWS).toBe(5);
    expect(showListTools(0)).toBe(false);
    expect(showListTools(4)).toBe(false);
  });

  it("shows them from five rows on", () => {
    expect(showListTools(5)).toBe(true);
    expect(showListTools(40)).toBe(true);
  });

  it("keeps them while a search or a status filter is in force, so the way back is never hidden", () => {
    expect(showListTools(3, { search: "git" })).toBe(true);
    expect(showListTools(3, { filter: "borradores" })).toBe(true);
    expect(showListTools(3, { filter: "todos", search: "" })).toBe(false);
  });
});
