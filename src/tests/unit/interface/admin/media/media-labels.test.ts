import { describe, expect, it } from "vitest";

import { formatBytes, parseMediaCursor } from "@/interface/admin/media/media-labels";

describe("parseMediaCursor", () => {
  it("accepts an opaque token", () => {
    expect(parseMediaCursor("a1b2c3d4e5f6")).toBe("a1b2c3d4e5f6");
  });

  it.each([undefined, "", ["a", "b"], "has space", "a/b", "../x", "x".repeat(201), "<script>"])("drops %j: the first page is shown", (raw) => {
    expect(parseMediaCursor(raw)).toBeUndefined();
  });
});

describe("formatBytes", () => {
  it.each([
    [0, "0 B"],
    [900, "900 B"],
    [1536, "1,5 KB"],
    [340 * 1024, "340 KB"],
    [1.2 * 1024 * 1024, "1,2 MB"],
    [-1, "—"],
    [Number.NaN, "—"],
  ])("%d is %s", (bytes, text) => {
    expect(formatBytes(bytes)).toBe(text);
  });
});
