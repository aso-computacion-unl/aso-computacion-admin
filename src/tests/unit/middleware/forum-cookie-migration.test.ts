import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FORUM_COOKIE_NAME, FORUM_COOKIE_PATH, FORUM_SESSION_DURATION_SECONDS, LEGACY_FORUM_COOKIE_NAME, LEGACY_FORUM_COOKIE_PATH, signForumSession } from "@/infrastructure/forum/forum-session-jwt";

import { proxy } from "../../../../proxy";

const ADMIN_SECRET = "admin-secret-admin-secret-admin-secret-1234";
const FORUM_SECRET = "forum-secret-forum-secret-forum-secret-1234";

function requestWith(path: string, cookies: Record<string, string>): NextRequest {
  const headers = new Headers();
  const header = Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");

  if (header) headers.set("cookie", header);

  return new NextRequest(new URL(path, "http://localhost:3000"), { headers });
}

/** The cookie header the route behind the proxy will see (Next carries it in `x-middleware-request-cookie`). */
const forwardedCookies = (response: Response) => response.headers.get("x-middleware-request-cookie");

beforeEach(() => {
  vi.stubEnv("ADMIN_SECRET", ADMIN_SECRET);
  vi.stubEnv("FORUM_SESSION_SECRET", FORUM_SECRET);
});

afterEach(() => vi.unstubAllEnvs());

describe("the forum session cookie moves from /foro to the whole site", () => {
  it("names the legacy cookie the old way and the new one for the whole site", () => {
    expect(LEGACY_FORUM_COOKIE_NAME).toBe("forum_session");
    expect(LEGACY_FORUM_COOKIE_PATH).toBe("/foro");
    expect(FORUM_COOKIE_NAME).toBe("forum_sid");
    expect(FORUM_COOKIE_PATH).toBe("/");
  });

  it.each(["/foro", "/foro/hilo/x", "/foro/eventos", "/foro/auth/google/callback", "/inscripciones/taller-git"])(
    "legacy only (%s): sets the new cookie with the same value, expires the legacy one and lets this request see the session",
    async (path) => {
      const token = await signForumSession({ sid: "s1", memberId: "m1" });

      const response = await proxy(requestWith(path, { [LEGACY_FORUM_COOKIE_NAME]: token, theme: "dark" }));

      expect(response.headers.get("x-middleware-next")).toBe("1");
      expect(response.cookies.get(FORUM_COOKIE_NAME)).toMatchObject({
        value: token,
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        maxAge: FORUM_SESSION_DURATION_SECONDS,
      });
      expect(response.cookies.get(LEGACY_FORUM_COOKIE_NAME)).toMatchObject({ value: "", path: "/foro", maxAge: 0, httpOnly: true });
      expect(forwardedCookies(response)).toContain(`${FORUM_COOKIE_NAME}=${token}`);
      expect(forwardedCookies(response)).toContain("theme=dark");
      expect(forwardedCookies(response)).not.toContain(LEGACY_FORUM_COOKIE_NAME);
      expect(response.headers.get("x-middleware-override-headers")).toContain("cookie");
    },
  );

  it("both present: changes nothing", async () => {
    const legacy = await signForumSession({ sid: "old", memberId: "m1" });
    const current = await signForumSession({ sid: "new", memberId: "m1" });

    const response = await proxy(requestWith("/foro", { [LEGACY_FORUM_COOKIE_NAME]: legacy, [FORUM_COOKIE_NAME]: current }));

    expect(response.headers.get("set-cookie")).toBeNull();
    expect(forwardedCookies(response)).toBeNull();
  });

  it("an invalid legacy token is expired and never copied", async () => {
    const response = await proxy(requestWith("/foro/hilo/x", { [LEGACY_FORUM_COOKIE_NAME]: "not-a-jwt" }));

    expect(response.cookies.get(FORUM_COOKIE_NAME)).toBeUndefined();
    expect(response.cookies.get(LEGACY_FORUM_COOKIE_NAME)).toMatchObject({ value: "", path: "/foro", maxAge: 0 });
    expect(forwardedCookies(response)).toBeNull();
  });

  it("a legacy token signed with another secret is expired and never copied", async () => {
    vi.stubEnv("FORUM_SESSION_SECRET", "other-secret-other-secret-other-secret-123");
    const forged = await signForumSession({ sid: "s", memberId: "m" });
    vi.stubEnv("FORUM_SESSION_SECRET", FORUM_SECRET);

    const response = await proxy(requestWith("/foro", { [LEGACY_FORUM_COOKIE_NAME]: forged }));

    expect(response.cookies.get(FORUM_COOKIE_NAME)).toBeUndefined();
    expect(response.cookies.get(LEGACY_FORUM_COOKIE_NAME)).toMatchObject({ maxAge: 0 });
  });

  it("with no usable forum secret nothing is copied or expired: the legacy cookie is left for when it is fixed", async () => {
    const token = await signForumSession({ sid: "s1", memberId: "m1" });
    vi.stubEnv("FORUM_SESSION_SECRET", "short");

    const response = await proxy(requestWith("/foro", { [LEGACY_FORUM_COOKIE_NAME]: token }));

    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it.each([
    ["/foro", {}],
    ["/foro/hilo/x", { theme: "dark" }],
    ["/inscripciones/x", {}],
  ])("neither cookie (%s): no Set-Cookie at all", async (path, cookies) => {
    const response = await proxy(requestWith(path, cookies));

    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it.each(["/login", "/api/health", "/invitacion/x", "/api/public/events/x/registrations"])("does not touch the cookies of %s", async (path) => {
    const token = await signForumSession({ sid: "s1", memberId: "m1" });

    const response = await proxy(requestWith(path, { [LEGACY_FORUM_COOKIE_NAME]: token }));

    expect(response.headers.get("set-cookie")).toBeNull();
  });
});
