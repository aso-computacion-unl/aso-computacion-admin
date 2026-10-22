import { describe, expect, it } from "vitest";

import { buildContentSecurityPolicy, SECURITY_HEADERS } from "@/infrastructure/http/security-headers";

function scriptSrc(policy: string): string {
  return policy.split("; ").find((directive) => directive.startsWith("script-src")) ?? "";
}

describe("buildContentSecurityPolicy", () => {
  it("never allows eval in production", () => {
    expect(scriptSrc(buildContentSecurityPolicy("production"))).toBe("script-src 'self' 'unsafe-inline'");
  });

  it("allows eval only under next dev, whose React runtime needs it to hydrate", () => {
    expect(scriptSrc(buildContentSecurityPolicy("development"))).toBe(
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    );
  });

  it("keeps every other directive identical between environments", () => {
    const strip = (policy: string) => policy.replace(" 'unsafe-eval'", "");

    expect(strip(buildContentSecurityPolicy("development"))).toBe(buildContentSecurityPolicy("production"));
  });

  it("ships the strict policy outside development (tests, builds)", () => {
    const shipped = SECURITY_HEADERS.find((header) => header.key === "Content-Security-Policy")?.value ?? "";

    expect(shipped).not.toContain("unsafe-eval");
  });
});
