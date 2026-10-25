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

  it("allows only the Sentry ingest origin for connections, and only when a DSN is configured", () => {
    const connectSrc = (policy: string) => policy.split("; ").find((directive) => directive.startsWith("connect-src"));

    expect(connectSrc(buildContentSecurityPolicy("production"))).toBe("connect-src 'self'");
    expect(connectSrc(buildContentSecurityPolicy("production", "https://key@o1.ingest.us.sentry.io/2"))).toBe(
      "connect-src 'self' https://o1.ingest.us.sentry.io",
    );
  });

  it("ignores a DSN that is not an https URL", () => {
    for (const dsn of ["", "not a url", "http://key@o1.ingest.sentry.io/2"]) {
      expect(buildContentSecurityPolicy("production", dsn)).toBe(buildContentSecurityPolicy("production"));
    }
  });
});
