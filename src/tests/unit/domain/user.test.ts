import { describe, expect, it } from "vitest";

import { ValidationError } from "@/domain/domain-error";
import { emailDomain, normalizeEmail, parseRole, parseUserName, roleSatisfies } from "@/domain/user";

describe("normalizeEmail", () => {
  it("trims and lower-cases", () => {
    expect(normalizeEmail("  Ana.Perez@Example.ORG ")).toBe("ana.perez@example.org");
  });

  it.each(["", "ana", "ana@", "@example.org", "ana@example", "a na@example.org", "a@b@example.org", `${"a".repeat(250)}@example.org`])(
    "rejects %j",
    (value) => {
      expect(() => normalizeEmail(value)).toThrow(ValidationError);
    },
  );
});

describe("emailDomain", () => {
  it("is what follows the last @", () => {
    expect(emailDomain("ana@unl.edu.ec")).toBe("unl.edu.ec");
  });
});

describe("parseRole", () => {
  it("accepts the two roles and nothing else", () => {
    expect(parseRole("ADMIN")).toBe("ADMIN");
    expect(parseRole("EDITOR")).toBe("EDITOR");
    expect(() => parseRole("admin")).toThrow(ValidationError);
    expect(() => parseRole(null)).toThrow(ValidationError);
  });
});

describe("parseUserName", () => {
  it("trims and bounds the length", () => {
    expect(parseUserName("  Ana ")).toBe("Ana");
    expect(() => parseUserName("  ")).toThrow(ValidationError);
    expect(() => parseUserName("x".repeat(121))).toThrow(ValidationError);
  });
});

describe("roleSatisfies", () => {
  it("lets an admin do an editor's work but not the other way round", () => {
    expect(roleSatisfies("ADMIN", "EDITOR")).toBe(true);
    expect(roleSatisfies("ADMIN", "ADMIN")).toBe(true);
    expect(roleSatisfies("EDITOR", "EDITOR")).toBe(true);
    expect(roleSatisfies("EDITOR", "ADMIN")).toBe(false);
  });
});
