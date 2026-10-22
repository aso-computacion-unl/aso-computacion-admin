import { describe, expect, it } from "vitest";

import { requireRuntimeValue } from "@/infrastructure/config/runtime-env";

describe("requireRuntimeValue", () => {
  it.each([
    ["missing", undefined],
    ["blank", ""],
    ["whitespace", "   "],
    ["documented sentinel", "__REPLACE_ADMIN_SECRET__"],
    ["whitespace-wrapped sentinel", "  __REPLACE_ADMIN_SECRET__  "],
  ])("rejects a %s value without exposing it", (_label, value) => {
    expect(() => requireRuntimeValue("ADMIN_SECRET", value)).toThrow(
      "ADMIN_SECRET must be configured with a non-placeholder value.",
    );
  });

  it("returns a valid administrator value unchanged", () => {
    expect(requireRuntimeValue("ADMIN_PASSWORD", "local-admin-password")).toBe("local-admin-password");
  });

  it.each([
    "__REPLACE_CLOUDINARY_CLOUD_NAME__",
    "__REPLACE_CLOUDINARY_API_KEY__",
    "__REPLACE_CLOUDINARY_API_SECRET__",
  ])("rejects the documented Cloudinary sentinel %s", (value) => {
    expect(() => requireRuntimeValue("CLOUDINARY_API_SECRET", value)).toThrow(
      "CLOUDINARY_API_SECRET must be configured with a non-placeholder value.",
    );
  });
});
