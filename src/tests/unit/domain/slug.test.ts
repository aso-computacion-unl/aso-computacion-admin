import { describe, expect, it } from "vitest";

import { ValidationError } from "@/domain";
import { assertSlug, slugify } from "@/domain/slug";
import { ADVERSARIAL_LENGTH, expectLinear } from "@/tests/support/linear-time";

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

  it.each([
    ["---", ""],
    ["-a-", "a"],
    ["--a--b--", "a-b"],
    ["a", "a"],
    ["", ""],
    ["  ¡Hola, mundo!  ", "hola-mundo"],
    ["Ünï-cödé  ÑANDÚ", "uni-code-nandu"],
    [`${"a".repeat(79)} b`, "a".repeat(79)],
    [`${"a".repeat(78)}  b c`, `${"a".repeat(78)}-b`],
    [`${"a".repeat(80)}-b`, "a".repeat(80)],
  ])("turns %j into %j (hyphen trimming and cap boundaries)", (title, slug) => {
    expect(slugify(title)).toBe(slug);
  });

  it("stays fast on very long runs of separators", () => {
    expect(expectLinear(() => slugify(`${"-".repeat(ADVERSARIAL_LENGTH)}a${"-".repeat(ADVERSARIAL_LENGTH)}`))).toBe("a");
    expect(expectLinear(() => slugify(`${"!".repeat(ADVERSARIAL_LENGTH)}é${" ".repeat(ADVERSARIAL_LENGTH)}`))).toBe("e");
    expect(expectLinear(() => slugify("-".repeat(ADVERSARIAL_LENGTH)))).toBe("");
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
