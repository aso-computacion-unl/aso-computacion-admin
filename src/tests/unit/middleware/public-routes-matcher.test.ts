import { describe, expect, it } from "vitest";

import { config } from "../../../../middleware";
import { matcherCovers } from "./support";

describe("middleware matcher: public routes", () => {
  it("PUB-MW: the matcher is exactly the protected paths plus the dynamic public prefixes", () => {
    expect(config.matcher).toEqual(["/", "/admin/:path*", "/foro/:path+", "/invitacion/:path+", "/api/public/events/:path+"]);
  });

  it.each(["/api/health", "/api/public/events", "/api/public/site", "/api/public/content"])("PUB-MW: matcher does not intercept %s", (path) => {
    expect(matcherCovers(config.matcher, path)).toBe(false);
  });

  it.each(["/foro", "/foro/", "/invitacion", "/login", "/auth/google/start", "/api/cron/scheduled-rebuild", "/_next/static/chunk.js", "/favicon.ico"])(
    "PUB-MW: matcher leaves %s alone",
    (path) => {
      expect(matcherCovers(config.matcher, path)).toBe(false);
    },
  );

  it.each([
    "/foro/eventos/x",
    "/foro/hilo/x",
    "/foro/c/x/nuevo",
    "/invitacion/x",
    "/api/public/events/x/calendar.ics",
    "/api/public/events/x/registrations",
  ])("PUB-MW: the matcher covers the dynamic public route %s for the URL check", (path) => {
    expect(matcherCovers(config.matcher, path)).toBe(true);
  });

  it("PUB-MW: a lookalike path does not widen the /admin allowlist", () => {
    expect(matcherCovers(config.matcher, "/administrator")).toBe(false);
  });
});
