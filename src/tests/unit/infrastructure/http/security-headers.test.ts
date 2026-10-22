import { describe, expect, it } from "vitest";

import { SECURITY_HEADERS } from "@/infrastructure/http/security-headers";

/** Turns the header list into a name->value lookup for readable assertions. */
function asMap(): Map<string, string> {
  return new Map(SECURITY_HEADERS.map((header) => [header.key, header.value]));
}

describe("SECURITY_HEADERS", () => {
  const headers = asMap();

  it("denies framing to prevent clickjacking", () => {
    expect(headers.get("X-Frame-Options")).toBe("DENY");
  });

  it("blocks MIME sniffing", () => {
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("sends a privacy-preserving referrer policy", () => {
    expect(headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
  });

  it("locks down powerful browser features by default", () => {
    const policy = headers.get("Permissions-Policy");
    expect(policy).toContain("camera=()");
    expect(policy).toContain("microphone=()");
    expect(policy).toContain("geolocation=()");
  });

  it("forces HTTPS on subsequent visits via HSTS", () => {
    const hsts = headers.get("Strict-Transport-Security");
    expect(hsts).toBeDefined();
    // A meaningful max-age (>= 180 days) and subdomain coverage.
    const maxAge = Number(/max-age=(\d+)/.exec(hsts ?? "")?.[1] ?? "0");
    expect(maxAge).toBeGreaterThanOrEqual(15552000);
    expect(hsts).toContain("includeSubDomains");
  });

  it("ships a content security policy that forbids framing and plugins", () => {
    const csp = headers.get("Content-Security-Policy");
    expect(csp).toBeDefined();
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("default-src 'self'");
  });

  it("allows Cloudinary as an image source (admin previews load remote images)", () => {
    const csp = headers.get("Content-Security-Policy") ?? "";
    expect(csp).toContain("res.cloudinary.com");
  });

  it("exposes every header with a non-empty string value", () => {
    for (const header of SECURITY_HEADERS) {
      expect(header.key.length).toBeGreaterThan(0);
      expect(header.value.length).toBeGreaterThan(0);
    }
  });
});
