import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Framework-level regression (design Fix Round 2 item 1): a real Server
 * Action invocation isn't feasible in this unit-test layer (no running Next
 * server, no component harness — see spec's Manual-Smoke Requirement), so
 * this asserts the raised body size ceiling is actually configured; the
 * end-to-end "~2MB image accepted" behavior is verified via manual smoke.
 */
describe("next.config.ts Server Actions body size limit", () => {
  const configSource = readFileSync(join(__dirname, "..", "..", "..", "..", "next.config.ts"), "utf8");

  it("raises the Server Actions body size limit to 6mb", () => {
    expect(configSource).toMatch(/bodySizeLimit:\s*["']6mb["']/);
  });
});
