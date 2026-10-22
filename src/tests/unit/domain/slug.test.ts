import { describe, expect, it } from "vitest";

import { ValidationError } from "@/domain";
import { assertSlug, slugify } from "@/domain/slug";

describe("slugify", () => {
  it.each([
    ["Hackatón 24 horas", "hackaton-24-horas"],
    ["  Taller: Git & GitHub  ", "taller-git-github"],
    ["Ñandú — charla #1", "nandu-charla-1"],
  ])("turns %j into %j", (title, slug) => {
    expect(slugify(title)).toBe(slug);
  });

  it("caps the slug length without leaving a trailing hyphen", () => {
    const slug = slugify(`${"palabra ".repeat(30)}fin`);

    expect(slug.length).toBeLessThanOrEqual(80);
    expect(slug.endsWith("-")).toBe(false);
  });

  it("returns an empty string when nothing usable remains", () => {
    expect(slugify("¡¿?!")).toBe("");
  });
});

describe("assertSlug", () => {
  it("accepts lowercase words joined by single hyphens", () => {
    expect(() => assertSlug("hackaton-24-horas")).not.toThrow();
  });

  it.each(["", "Hackaton", "a--b", "-a", "a-", "a b", "ñandu", "a".repeat(81)])("rejects %j", (slug) => {
    expect(() => assertSlug(slug)).toThrow(ValidationError);
  });
});
