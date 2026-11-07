import { describe, expect, it } from "vitest";

import { shouldRebuildSite } from "@/interface/admin/site-rebuild-policy";

describe("shouldRebuildSite", () => {
  it.each([
    [false, false, false],
    [false, true, true],
    [true, false, true],
    [true, true, true],
  ])("was published %s, is published %s -> rebuild %s", (wasPublished, isPublished, expected) => {
    expect(shouldRebuildSite(wasPublished, isPublished)).toBe(expected);
  });
});
