import { describe, expect, it } from "vitest";

import { parseReorderKind, parseReorderRequest, REORDER_KIND_MESSAGE, REORDER_MAX_POSITION } from "@/interface/admin/reorder/reorder-input";

describe("parseReorderKind", () => {
  it.each(["faq", "command", "social", "pillar", "board", "sponsor"])("accepts %s", (kind) => {
    expect(parseReorderKind(kind)).toBe(kind);
  });

  it.each(["event", "news", "", "FAQ", "impact", "testimonial", undefined, 3, null])("refuses %s: events and news are ordered by date, impact and testimonials are no longer managed", (kind) => {
    expect(parseReorderKind(kind)).toBeNull();
  });
});

describe("parseReorderRequest", () => {
  it("accepts a known kind, an id and a 0-based place", () => {
    expect(parseReorderRequest("pillar", "abc", 0)).toEqual({ kind: "pillar", id: "abc", position: 0 });
    expect(parseReorderRequest("faq", "abc", REORDER_MAX_POSITION)).toEqual({ kind: "faq", id: "abc", position: REORDER_MAX_POSITION });
  });

  it("refuses an unknown kind with its own message", () => {
    expect(parseReorderRequest("event", "abc", 1)).toEqual({ error: REORDER_KIND_MESSAGE });
  });

  it.each([
    ["a blank id", " ", 1],
    ["a missing id", undefined, 1],
    ["an id that is too long", "x".repeat(65), 1],
    ["a negative place", "abc", -1],
    ["a fractional place", "abc", 1.5],
    ["NaN", "abc", Number.NaN],
    ["Infinity", "abc", Number.POSITIVE_INFINITY],
    ["a place past the maximum", "abc", REORDER_MAX_POSITION + 1],
    ["a place that is a string", "abc", "2"],
  ])("refuses %s", (_label, id, position) => {
    expect(parseReorderRequest("faq", id, position)).toHaveProperty("error");
  });
});
