import { describe, expect, it, vi } from "vitest";

// The Sentry wrapper only matters at build time; the config under test is the one it wraps.
vi.mock("@sentry/nextjs/config", () => ({ withSentryConfig: (config: unknown) => config }));

import nextConfig from "../../../../../next.config";

describe("next.config: the registration route", () => {
  it("answers the old /foro/eventos/<slug> with a permanent redirect to /inscripciones/<slug>", async () => {
    expect(await nextConfig.redirects?.()).toEqual([{ source: "/foro/eventos/:slug", destination: "/inscripciones/:slug", permanent: true }]);
  });

  it("applies the security headers, Turnstile's CSP included, to every path, /inscripciones/<slug> among them", async () => {
    const [rule] = (await nextConfig.headers?.()) ?? [];
    const csp = rule?.headers.find((header) => header.key === "Content-Security-Policy")?.value ?? "";

    expect(rule?.source).toBe("/:path*");
    expect(csp).toContain("script-src 'self' 'unsafe-inline'");
    expect(csp).toContain("https://challenges.cloudflare.com");
    expect(csp).toContain("frame-src https://challenges.cloudflare.com");
  });
});
