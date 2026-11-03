import { describe, expect, it } from "vitest";

import { countsSummary, pluralize, publicationSummary } from "@/interface/admin/publication-summary";

describe("pluralize", () => {
  it("picks the singular only for exactly one", () => {
    expect(pluralize(0, "borrador", "borradores")).toBe("0 borradores");
    expect(pluralize(1, "borrador", "borradores")).toBe("1 borrador");
    expect(pluralize(2, "borrador", "borradores")).toBe("2 borradores");
  });
});

describe("publicationSummary", () => {
  it("counts published items and drafts", () => {
    const items = [{ isPublished: true }, { isPublished: true }, { isPublished: false }];

    expect(publicationSummary(items)).toBe("2 publicados · 1 borrador");
  });

  it("uses the singular for one published item", () => {
    expect(publicationSummary([{ isPublished: true }])).toBe("1 publicado · 0 borradores");
  });

  it("says the list is empty instead of two zeros", () => {
    expect(publicationSummary([])).toBe("Sin elementos todavía");
  });
});

describe("countsSummary", () => {
  it("words the totals the same way as the item list", () => {
    expect(countsSummary({ published: 2, draft: 1 })).toBe("2 publicados · 1 borrador");
    expect(countsSummary({ published: 1, draft: 0 })).toBe("1 publicado · 0 borradores");
  });

  it("says the list is empty instead of two zeros", () => {
    expect(countsSummary({ published: 0, draft: 0 })).toBe("Sin elementos todavía");
  });
});
