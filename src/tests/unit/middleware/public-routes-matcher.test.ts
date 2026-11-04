import { describe, expect, it } from "vitest";

import { config } from "../../../../middleware";
import { matcherCovers } from "./support";

describe("middleware matcher: public routes", () => {
  it("PUB-MW: the matcher is exactly the protected paths, the dynamic public prefixes and the backslash paths", () => {
    expect(config.matcher).toEqual(["/", "/admin/:path*", "/foro/:path+", "/invitacion/:path+", "/api/public/events/:path+", "/(.*(?:%5[Cc]|\\\\).*)"]);
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

  // A backslash is a slash to Next, so these spellings of /admin and / must reach the middleware.
  it.each(["/%5Cadmin", "/admin%5Cevents", "/%5Cadmin%5Cevents", "/%5C%5Cadmin", "/%2F%5Cadmin", "/%5C", "/%5cadmin", "/\\admin", "/admin\\events", "/\\"])(
    "PUB-MW: the matcher covers the backslash spelling %s",
    (path) => {
      expect(matcherCovers(config.matcher, path)).toBe(true);
    },
  );

  it.each(["/%2561dmin", "/%255Cadmin", "/foro", "/login", "/administrator", "/api/health"])("PUB-MW: the backslash entry does not widen the matcher to %s", (path) => {
    expect(matcherCovers(config.matcher, path)).toBe(false);
  });
});
