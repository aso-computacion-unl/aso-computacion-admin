import { describe, expect, it } from "vitest";

import { BULK_MAX_ITEMS, parseBulkIds, parseBulkKind } from "@/interface/admin/bulk/bulk-input";

describe("parseBulkIds", () => {
  it("accepts a list of ids and keeps their order", () => {
    expect(parseBulkIds(["b", "a", "c"])).toEqual(["b", "a", "c"]);
  });

  it("drops repeated ids, so an item is never processed twice", () => {
    expect(parseBulkIds(["a", "b", "a"])).toEqual(["a", "b"]);
  });

  it("accepts exactly the maximum and refuses one more", () => {
    const ids = Array.from({ length: BULK_MAX_ITEMS + 1 }, (_, index) => `id-${index}`);

    expect(parseBulkIds(ids.slice(0, BULK_MAX_ITEMS))).toHaveLength(BULK_MAX_ITEMS);
    expect(parseBulkIds(ids)).toBeNull();
  });

  it.each([
    ["undefined", undefined],
    ["a string", "abc"],
    ["an object", { 0: "a" }],
    ["an empty list", []],
    ["a number inside", ["a", 1]],
    ["null inside", ["a", null]],
    ["an empty id", ["a", ""]],
    ["a blank id", ["a", "  "]],
    ["an id that is far too long", ["a".repeat(65)]],
  ])("refuses %s", (_label, value) => {
    expect(parseBulkIds(value)).toBeNull();
  });
});

describe("parseBulkKind", () => {
  it.each(["event", "news", "faq", "command", "social", "pillar", "board"])("accepts %s", (kind) => {
    expect(parseBulkKind(kind)).toBe(kind);
  });

  it.each([undefined, "", "events", "EVENT", "forum", "__proto__", 3])("refuses %j", (kind) => {
    expect(parseBulkKind(kind)).toBeNull();
  });
});
