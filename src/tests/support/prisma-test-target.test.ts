import { describe, expect, it } from "vitest";

import {
  assertSafePrismaTestTarget,
  CANONICAL_TEST_DATABASE_URL,
} from "./prisma-test-target";

describe("assertSafePrismaTestTarget", () => {
  it.each([
    ["missing", undefined],
    ["malformed", "not a database URL"],
    ["development", "postgresql://postgres:postgres@127.0.0.1:54329/aso_computacion_admin"],
  ])("rejects a %s database target without exposing it", (_name, value) => {
    expect(() => assertSafePrismaTestTarget(value)).toThrow(
      "TEST_DATABASE_URL must target the isolated Prisma test database.",
    );
    try {
      assertSafePrismaTestTarget(value);
    } catch (error) {
      expect(error).toBeInstanceOf(Error);

      if (value) {
        expect((error as Error).message).not.toContain(value);
      }
    }
  });

  it("accepts the canonical isolated database target", () => {
    expect(assertSafePrismaTestTarget(CANONICAL_TEST_DATABASE_URL).toString()).toBe(
      CANONICAL_TEST_DATABASE_URL,
    );
  });

  it("accepts the canonical target when its query string is normalized", () => {
    const normalizedTarget =
      "postgresql://postgres:postgres@127.0.0.1:54329/aso_computacion_admin_test?schema=public&";

    expect(assertSafePrismaTestTarget(normalizedTarget).searchParams.get("schema")).toBe("public");
  });

  it.each([
    ["host", "postgresql://postgres:postgres@localhost:54329/aso_computacion_admin_test?schema=public"],
    ["port", "postgresql://postgres:postgres@127.0.0.1:54330/aso_computacion_admin_test?schema=public"],
    ["database", "postgresql://postgres:postgres@127.0.0.1:54329/another_test?schema=public"],
    ["user", "postgresql://another:postgres@127.0.0.1:54329/aso_computacion_admin_test?schema=public"],
    ["password", "postgresql://postgres:another@127.0.0.1:54329/aso_computacion_admin_test?schema=public"],
  ])("rejects a canonical target with a changed %s", (_part, value) => {
    expect(() => assertSafePrismaTestTarget(value)).toThrow(
      "TEST_DATABASE_URL must target the isolated Prisma test database.",
    );
  });
});
