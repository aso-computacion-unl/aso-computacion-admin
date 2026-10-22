import { describe, expect, it } from "vitest";

import { assertNoFocusedOrSkippedIntegrationTests } from "./prisma-integration-test-contract";

describe("assertNoFocusedOrSkippedIntegrationTests", () => {
  it("rejects focused integration tests before they can hide coverage", () => {
    expect(() => assertNoFocusedOrSkippedIntegrationTests('it.only("focus", () => undefined);')).toThrow(
      "must not contain .only or .skip",
    );
  });

  it("rejects skipped integration tests instead of allowing conditional database coverage", () => {
    expect(() => assertNoFocusedOrSkippedIntegrationTests('describe.skip("database", () => undefined);')).toThrow(
      "must not contain .only or .skip",
    );
  });

  it.each([
    'describe.skipIf(true)("database", () => undefined);',
    'it.skipIf(true)("database", () => undefined);',
    'test.skipIf(true)("database", () => undefined);',
    'describe.runIf(false)("database", () => undefined);',
    'it.runIf(false)("database", () => undefined);',
    'test.runIf(false)("database", () => undefined);',
    'describe.onlyIf(true)("database", () => undefined);',
    'it.onlyIf(true)("database", () => undefined);',
    'test.onlyIf(true)("database", () => undefined);',
    'describe.concurrent.only("database", () => undefined);',
    'it.skip.each([["database"]])("%s", () => undefined);',
    'test.todo("database");',
  ])("rejects conditional, focused, and chained skip forms: %s", (source) => {
    expect(() => assertNoFocusedOrSkippedIntegrationTests(source)).toThrow(
      "must not contain focused or skipped modifiers",
    );
  });

  it.each([
    'suite.skipIf(true)("database", () => undefined);',
    'suite["skipIf"](true)("database", () => undefined);',
    'describe["runIf"](false)("database", () => undefined);',
    'it["skip"]("database", () => undefined);',
    'test["only"]("database", () => undefined);',
    'suite.concurrent["only"]("database", () => undefined);',
  ])("rejects alias and bracket-notation modifiers: %s", (source) => {
    expect(() => assertNoFocusedOrSkippedIntegrationTests(source)).toThrow(
      "must not contain focused or skipped modifiers",
    );
  });

  it.each([
    'it[modifier]("database", () => undefined);',
    'describe.concurrent[modifier]("database", () => undefined);',
  ])("rejects non-static computed modifiers without attempting to evaluate them: %s", (source) => {
    expect(() => assertNoFocusedOrSkippedIntegrationTests(source)).toThrow(
      "must not contain focused or skipped modifiers",
    );
  });

  it("ignores modifier-shaped text in comments and strings", () => {
    const source = [
      '// it["skip"]("comment", () => undefined);',
      "/*",
      'suite.skipIf(true)("comment", () => undefined);',
      "*/",
      "const documentation = `",
      'test.only("string", () => undefined);',
      "`;",
      'it("persists", () => undefined);',
    ].join("\n");

    expect(() => assertNoFocusedOrSkippedIntegrationTests(source)).not.toThrow();
  });

  it("accepts ordinary executable integration tests", () => {
    expect(() => assertNoFocusedOrSkippedIntegrationTests('it("persists", () => undefined);')).not.toThrow();
  });
});
