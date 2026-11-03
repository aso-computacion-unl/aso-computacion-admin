import { describe, expect, it } from "vitest";

import { publicationWhere, searchWhere, toPublicationCounts } from "@/infrastructure/repositories/publication-filter";

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

describe("searchWhere", () => {
  it("adds nothing for a missing or blank search, so every live row stays visible", () => {
    expect(searchWhere(undefined, ["title"])).toEqual({});
    expect(searchWhere("   ", ["title"])).toEqual({});
    expect(publicationWhere({ search: "  " }, ["title"] as const)).toEqual({ deletedAt: null });
  });

  it("matches any of the fields, ignoring case and surrounding spaces", () => {
    expect(searchWhere("  taller ", ["title", "slug"])).toEqual({
      OR: [
        { title: { contains: "taller", mode: "insensitive" } },
        { slug: { contains: "taller", mode: "insensitive" } },
      ],
    });
  });

  it("escapes LIKE wildcards so a search for 100% does not match everything", () => {
    expect(searchWhere("100%_a\\b", ["title"])).toEqual({ OR: [{ title: { contains: "100\\%\\_a\\\\b", mode: "insensitive" } }] });
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
