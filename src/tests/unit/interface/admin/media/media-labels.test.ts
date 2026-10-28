import { describe, expect, it } from "vitest";

import { formatBytes, mediaHref, parseMediaCursor, usageHref } from "@/interface/admin/media/media-labels";

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

describe("links", () => {
  it("points a use at the edit page of its owner", () => {
    expect(usageHref({ kind: "pillar", id: "p1" })).toBe("/admin/pillars/p1/edit");
    expect(usageHref({ kind: "board", id: "b1" })).toBe("/admin/board/b1/edit");
    expect(usageHref({ kind: "event", id: "e1" })).toBe("/admin/events/e1/edit");
    expect(usageHref({ kind: "news", id: "n1" })).toBe("/admin/news/n1/edit");
    expect(usageHref({ kind: "sponsor", id: "s1" })).toBe("/admin/sponsors/s1/edit");
  });

  it("has no link for a testimonial: its page is gone but its photo is still in use", () => {
    expect(usageHref({ kind: "testimonial", id: "t1" })).toBeNull();
  });

  it("builds the page link with the cursor encoded, and the plain path for the first page", () => {
    expect(mediaHref()).toBe("/admin/medios");
    expect(mediaHref("a b")).toBe("/admin/medios?despues=a%20b");
  });
});
