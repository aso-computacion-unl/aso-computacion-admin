import { describe, expect, it } from "vitest";

import nextConfig from "../../../../next.config";
import { SECURITY_HEADERS } from "@/infrastructure/http/security-headers";

describe("next.config.ts security headers", () => {
  it("applies the shared security-header policy to every route", async () => {
    const rules = (await nextConfig.headers?.()) ?? [];

    expect(rules).toHaveLength(1);
    expect(rules[0]?.source).toBe("/:path*");
    expect(rules[0]?.headers).toEqual(SECURITY_HEADERS.map((header) => ({ ...header })));
  });

  it("does not advertise the framework", () => {
    expect(nextConfig.poweredByHeader).toBe(false);
  });
});
