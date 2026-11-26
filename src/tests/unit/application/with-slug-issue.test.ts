import { describe, expect, it, vi } from "vitest";

import { withSlugChangeIssue, withSlugIssue } from "@/application/use-cases/with-slug-issue";
import { ValidationError } from "@/domain";

const taken = () => new ValidationError("slug", "slug is already used by another event");

describe("withSlugIssue (create) precedence", () => {
  it("a taken slug wins over a non-validation error from build", async () => {
    const slugError = taken();

    await expect(
      withSlugIssue(
        () => Promise.reject(slugError),
        undefined,
        () => {
          throw new TypeError("boom");
        },
      ),
    ).rejects.toBe(slugError);
  });

  it("a non-validation error from build passes through when the slug is fine", async () => {
    await expect(
      withSlugIssue(
        () => Promise.resolve("ok"),
        undefined,
        () => {
          throw new TypeError("boom");
        },
      ),
    ).rejects.toThrow(TypeError);
  });

  it("builds with the explicit slug the caller asked for when it is taken", async () => {
    const build = vi.fn((slug: string | undefined) => {
      throw new ValidationError("title", `title is required (slug ${slug})`);
    });

    await expect(withSlugIssue(() => Promise.reject(taken()), "semana-de-la-computacion", build)).rejects.toMatchObject({
      issues: [
        { field: "slug", message: "slug is already used by another event" },
        { field: "title", message: "title is required (slug semana-de-la-computacion)" },
      ],
    });
    expect(build).toHaveBeenCalledExactlyOnceWith("semana-de-la-computacion");
  });

  it("a single failure on either side is the original error object", async () => {
    const slugError = taken();
    const buildError = new ValidationError("linkLabel", "linkLabel needs a linkUrl");

    await expect(withSlugIssue(() => Promise.reject(slugError), undefined, () => 1)).rejects.toBe(slugError);
    await expect(
      withSlugIssue(
        () => Promise.resolve("ok"),
        undefined,
        () => {
          throw buildError;
        },
      ),
    ).rejects.toBe(buildError);
  });
});

describe("withSlugChangeIssue (update)", () => {
  it("a taken slug wins over a non-validation error from build", async () => {
    const slugError = taken();

    await expect(
      withSlugChangeIssue(
        () => Promise.reject(slugError),
        () => {
          throw new TypeError("boom");
        },
      ),
    ).rejects.toBe(slugError);
  });

  it("joins the taken slug and the entity's failures, slug first", async () => {
    const error = await withSlugChangeIssue(
      () => Promise.reject(taken()),
      () => {
        throw new ValidationError("linkLabel", "linkLabel needs a linkUrl");
      },
    ).catch((caught: unknown) => caught);

    expect((error as ValidationError).issues).toEqual([
      { field: "slug", message: "slug is already used by another event" },
      { field: "linkLabel", message: "linkLabel needs a linkUrl" },
    ]);
  });

  it("returns the built entity when both sides pass", async () => {
    await expect(withSlugChangeIssue(() => Promise.resolve("free"), () => "built")).resolves.toBe("built");
  });
});
