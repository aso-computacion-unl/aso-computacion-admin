import { readdirSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { config, middleware } from "../../../../middleware";
import { buildRequest, matcherCovers } from "./support";

const APP_DIR = join(__dirname, "..", "..", "..", "..", "app");

/** The only routes that may be reachable without a session. Adding one here is a security decision. */
// The two Google routes are how a session is obtained, so they cannot require one: the callback only
// opens a session for a verified Google identity that is on the user list, behind the login throttle.
// The forum is a separate zone with its own session (`forum_session`, own secret, own guard): its pages and
// its two Google routes are outside the admin middleware on purpose, and its guard fails closed. Every page
// of the student screens (`requireForumPageMember`) sends a visitor to the sign-in at `/foro`.
// `/foro/eventos/<slug>` is the UNL-account event registration page: it shows the event's registration state to
// anyone, and its action only works for a signed-in forum member (the forum guard, never the admin one).
// `/foro/eventos` lists the events open for registration: a student screen like the home, so a visitor without a
// forum session gets the same sign-in gate and no event.
const FORUM_ROUTES = ["/foro", "/foro/c/x", "/foro/c/x/nuevo", "/foro/hilo/x", "/foro/auth/google/start", "/foro/auth/google/callback", "/foro/eventos", "/foro/eventos/x"];
// `/invitacion/<token>` is where an invitee lands before they have an account: it only says whether the
// link still works (and for whom), and the sign-in it leads to is the same Google callback as above.
const PUBLIC_ROUTES: string[] = ["/login", "/invitacion/x", "/auth/google/start", "/auth/google/callback", "/api/health", "/api/public/content", "/api/public/preview", "/api/cron/scheduled-rebuild", ...FORUM_ROUTES];
// The open-form event registration is public by design: Turnstile, a strict rate limit and the atomic use case are its guards.
// The `.ics` download is public read-only data of a published event, with no personal data.
// `/api/public/events/seats` is public read-only counts (slug, capacity, registered, seats left): no personal data.
PUBLIC_ROUTES.push("/api/public/events/x/registrations", "/api/public/events/x/calendar.ics", "/api/public/events/seats");

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
  afterEach(() => vi.unstubAllEnvs());

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

  it("the public routes are not auth-guarded: the middleware lets them through without a session, even with a misconfigured secret", async () => {
    vi.stubEnv("ADMIN_SECRET", undefined);

    for (const route of PUBLIC_ROUTES) {
      const response = await middleware(buildRequest(route));

      expect(response.headers.get("x-middleware-next"), route).toBe("1");
    }
  });

  it("the matcher reaches a public route only for the undecodable-path check: the dynamic forum, invitation and public event routes", () => {
    const covered = PUBLIC_ROUTES.filter((route) => matcherCovers(config.matcher, route));

    expect(covered.length).toBeGreaterThan(0);
    for (const route of covered) expect(/^\/(foro\/|invitacion\/|api\/public\/events\/)/.test(route), route).toBe(true);
  });

  it("no public route lives under /admin or hides behind an admin-looking prefix", () => {
    expect(PUBLIC_ROUTES.filter((route) => route.startsWith("/admin"))).toEqual([]);
  });
});
