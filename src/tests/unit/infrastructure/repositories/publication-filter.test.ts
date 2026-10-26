import { describe, expect, it } from "vitest";

import { publicationWhere, toPublicationCounts } from "@/infrastructure/repositories/publication-filter";

describe("publicationWhere", () => {
  it("narrows by the published flag only when a status is asked for", () => {
    expect(publicationWhere({ status: "published" })).toEqual({ deletedAt: null, isPublished: true });
    expect(publicationWhere({ status: "draft" })).toEqual({ deletedAt: null, isPublished: false });
  });

  it("hides trashed rows but adds no status condition without a status, so no live row is hidden", () => {
    expect(publicationWhere({})).toEqual({ deletedAt: null });
    expect(publicationWhere()).toEqual({ deletedAt: null });
  });
});

describe("toPublicationCounts", () => {
  it("reads the two groups", () => {
    const groups = [
      { isPublished: false, _count: { _all: 3 } },
      { isPublished: true, _count: { _all: 5 } },
    ];

    expect(toPublicationCounts(groups)).toEqual({ published: 5, draft: 3 });
  });

  it("counts a state without rows as zero, since groupBy leaves it out", () => {
    expect(toPublicationCounts([{ isPublished: true, _count: { _all: 2 } }])).toEqual({ published: 2, draft: 0 });
    expect(toPublicationCounts([])).toEqual({ published: 0, draft: 0 });
  });
});
