import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { IMAGE_MAX_SIZE_BYTES } from "@/domain/image";
import { MAX_IMAGE_UPLOAD_REQUEST_BYTES } from "@/interface/validation/image-upload.schema";

/**
 * A real Server Action invocation isn't feasible in this unit-test layer (no
 * running Next server), so this asserts the configured body size ceiling stays
 * consistent with the 5 MB image limit: large enough for the biggest allowed
 * image plus multipart framing, but not unbounded.
 */
describe("next.config.ts Server Actions body size limit", () => {
  const configSource = readFileSync(join(__dirname, "..", "..", "..", "..", "next.config.ts"), "utf8");
  const limitMegabytes = Number(configSource.match(/bodySizeLimit:\s*["'](\d+)mb["']/)?.[1]);

  it("configures a bodySizeLimit expressed in whole megabytes", () => {
    expect(Number.isInteger(limitMegabytes)).toBe(true);
  });

  it("fits the largest allowed image plus multipart framing", () => {
    expect(limitMegabytes * 1024 * 1024).toBeGreaterThanOrEqual(MAX_IMAGE_UPLOAD_REQUEST_BYTES);
  });

  it("does not exceed the image limit by more than a megabyte", () => {
    expect(limitMegabytes * 1024 * 1024).toBeLessThanOrEqual(IMAGE_MAX_SIZE_BYTES + 1024 * 1024);
  });
});
