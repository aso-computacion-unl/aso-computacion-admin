import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { config } from "../../../../middleware";
import { matcherCovers } from "./support";

const APP_DIR = join(__dirname, "..", "..", "..", "..", "app");

/** The only routes that may be reachable without a session. Adding one here is a security decision. */
// The two Google routes are how a session is obtained, so they cannot require one: the callback only
// opens a session for a verified Google identity that is on the user list, behind the login throttle.
const PUBLIC_ROUTES = ["/login", "/auth/google/start", "/auth/google/callback", "/api/health", "/api/public/content"];

/** URL paths of every page and route handler under `app/`, with dynamic segments filled and route groups dropped. */
function discoverRoutes(dir: string = APP_DIR, prefix = ""): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) {
      const segment = /^\(.*\)$/.test(entry.name) ? "" : `/${entry.name.replace(/^\[.*\]$/, "x")}`;

      return discoverRoutes(join(dir, entry.name), `${prefix}${segment}`);
    }

    return /^(page|route)\.tsx?$/.test(entry.name) ? [prefix || "/"] : [];
  });
}

describe("route protection", () => {
  const routes = discoverRoutes();

  it("discovers the routes of the app (guards the discovery itself)", () => {
    expect(routes).toEqual(expect.arrayContaining(["/", "/login", "/admin", "/admin/events", "/admin/board/x/edit", "/api/health", "/api/public/content"]));
  });

  it("every route is either an intentionally public one or covered by the session middleware", () => {
    const unprotected = routes.filter((route) => !matcherCovers(config.matcher, route) && !PUBLIC_ROUTES.includes(route));

    expect(unprotected).toEqual([]);
  });

  it("every admin page and server-action target stays behind the middleware", () => {
    const admin = routes.filter((route) => route === "/admin" || route.startsWith("/admin/"));

    expect(admin.length).toBeGreaterThan(10);
    for (const route of admin) expect(matcherCovers(config.matcher, route), route).toBe(true);
  });

  it("the public routes are not touched by the middleware, so they need no session", () => {
    for (const route of PUBLIC_ROUTES) expect(matcherCovers(config.matcher, route), route).toBe(false);
  });

  it("no public route lives under /admin or hides behind an admin-looking prefix", () => {
    expect(PUBLIC_ROUTES.filter((route) => route.startsWith("/admin"))).toEqual([]);
  });
});
