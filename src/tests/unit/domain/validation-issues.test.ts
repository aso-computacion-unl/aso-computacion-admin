import { describe, expect, it } from "vitest";

import { ValidationError } from "@/domain";
import { Event } from "@/domain/event";
import { NewsItem } from "@/domain/news-item";

const OPEN = new Date("2026-11-09T13:00:00.000Z");
const BEFORE_OPEN = new Date("2026-11-02T13:00:00.000Z");
const SLUG_MESSAGE = "slug must be lowercase letters and digits separated by hyphens (at most 80 characters)";
const NEWS = { title: "Taller de Git", summary: "Resumen.", body: "Texto." };

function caught(run: () => unknown): ValidationError {
  try {
    run();
  } catch (error) {
    if (error instanceof ValidationError) return error;
    throw error;
  }

  throw new Error("expected a ValidationError");
}

describe("ValidationError issues", () => {
  it("a single-field error carries exactly that one issue", () => {
    const error = new ValidationError("slug", "bad");

    expect(error).toMatchObject({ field: "slug", message: "bad" });
    expect(error.issues).toEqual([{ field: "slug", message: "bad" }]);
  });

  it("an aggregate keeps every issue and exposes the first as field and message", () => {
    const error = ValidationError.fromIssues([
      { field: "slug", message: "a" },
      { field: "linkLabel", message: "b" },
    ]);

    expect(error).toBeInstanceOf(ValidationError);
    expect(error).toMatchObject({ field: "slug", message: "a" });
    expect(error.issues).toHaveLength(2);
  });
});

describe("Event reports every failing rule at once", () => {
  it("bad slug, link label without link and unpublish before publish come back together", () => {
    const error = caught(() =>
      Event.create({ title: "Hackatón", slug: "Mal Slug", linkLabel: "Inscríbete", publishAt: OPEN, unpublishAt: BEFORE_OPEN }),
    );

    expect(error.issues).toEqual([
      { field: "slug", message: SLUG_MESSAGE },
      { field: "linkLabel", message: "linkLabel needs a linkUrl" },
      { field: "unpublishAt", message: "unpublishAt must be after publishAt" },
    ]);
    expect(error).toMatchObject({ field: "slug", message: SLUG_MESSAGE });
  });

  it("an update collects them too", () => {
    const event = Event.create({ title: "Hackatón" });
    const error = caught(() => event.update({ slug: "-", linkLabel: "Ver", publishAt: OPEN, unpublishAt: BEFORE_OPEN }));

    expect(error.issues.map((issue) => issue.field)).toEqual(["slug", "linkLabel", "unpublishAt"]);
  });

  it("a single failure is still exactly the old single error", () => {
    const error = caught(() => Event.create({ title: "Hackatón", linkLabel: "Ver" }));

    expect(error).toMatchObject({ field: "linkLabel", message: "linkLabel needs a linkUrl" });
    expect(error.issues).toEqual([{ field: "linkLabel", message: "linkLabel needs a linkUrl" }]);
  });
});

describe("NewsItem reports every failing rule at once", () => {
  it("bad slug and unpublish before publish come back together", () => {
    const error = caught(() => NewsItem.create({ ...NEWS, slug: "Mal Slug", publishAt: OPEN, unpublishAt: BEFORE_OPEN }));

    expect(error.issues).toEqual([
      { field: "slug", message: SLUG_MESSAGE },
      { field: "unpublishAt", message: "unpublishAt must be after publishAt" },
    ]);
  });

  it("a single failure is still exactly the old single error", () => {
    const error = caught(() => NewsItem.create({ ...NEWS, publishAt: OPEN, unpublishAt: BEFORE_OPEN }));

    expect(error).toMatchObject({ field: "unpublishAt", message: "unpublishAt must be after publishAt" });
    expect(error.issues).toHaveLength(1);
  });
});
