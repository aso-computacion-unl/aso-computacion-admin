import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { executeMock, cookiesMock } = vi.hoisted(() => ({ executeMock: vi.fn(), cookiesMock: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: cookiesMock, headers: vi.fn() }));
vi.mock("@/interface/public/public-content-container", () => ({
  getPublicContentUseCase: () => ({ execute: executeMock }),
}));

import { resetPublicRateLimiter, PUBLIC_RATE_LIMIT_MAX_REQUESTS } from "@/infrastructure/http/rate-limiter";
import * as route from "../../../../../app/api/public/content/route";

const LANDING = "https://aso-computacion.pages.dev";
const emptySnapshot = { events: [], faqs: [], pillars: [], socials: [], board: [], settings: null };

function get(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("https://admin.test/api/public/content", { headers });
}

beforeEach(() => {
  executeMock.mockReset();
  executeMock.mockResolvedValue(emptySnapshot);
  resetPublicRateLimiter();
  vi.stubEnv("PUBLIC_CORS_ORIGINS", LANDING);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("GET /api/public/content", () => {
  it("needs no session: it answers 200 JSON without any cookie", async () => {
    const response = await route.GET(get());

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toMatch(/application\/json/);
    expect(cookiesMock).not.toHaveBeenCalled();
    expect(response.headers.get("Set-Cookie")).toBeNull();
  });

  it("serves the versioned snapshot with the settings null when never saved", async () => {
    const body = await (await route.GET(get())).json();

    expect(Object.keys(body).sort()).toEqual(["board", "events", "faqs", "generatedAt", "pillars", "settings", "socials", "version"]);
    expect(body).toMatchObject({ version: 1, settings: null, events: [], board: [] });
    expect(Number.isNaN(Date.parse(body.generatedAt))).toBe(false);
  });

  it("is cacheable for a short while at the edge but never served stale to a build", async () => {
    const cacheControl = (await route.GET(get())).headers.get("Cache-Control");

    expect(cacheControl).toBe("public, max-age=0, s-maxage=5, must-revalidate");
    expect(cacheControl).not.toMatch(/stale-while-revalidate/);
  });

  it("is rendered per request, never prerendered at build time", () => {
    expect(route.dynamic).toBe("force-dynamic");
  });

  it("only reads: GET and OPTIONS are the only verbs it exports", () => {
    const verbs = Object.keys(route).filter((name) => /^[A-Z]+$/.test(name));

    expect(verbs.sort()).toEqual(["GET", "OPTIONS"]);
  });

  it("grants CORS to an allowlisted origin only, and varies on Origin", async () => {
    const allowed = await route.GET(get({ origin: LANDING }));
    const other = await route.GET(get({ origin: "https://evil.example" }));
    const none = await route.GET(get());

    expect(allowed.headers.get("Access-Control-Allow-Origin")).toBe(LANDING);
    expect(other.headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(none.headers.get("Access-Control-Allow-Origin")).toBeNull();
    for (const response of [allowed, other, none]) expect(response.headers.get("Vary")).toBe("Origin");
  });

  it("answers a failure with a generic 500 that is not cached, keeps CORS, and leaks no internals", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    executeMock.mockRejectedValue(new Error("connect ECONNREFUSED postgres://user:secret@db/aso"));

    const response = await route.GET(get({ origin: LANDING }));
    const text = await response.text();

    expect(response.status).toBe(500);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(LANDING);
    expect(text).not.toMatch(/postgres|secret|ECONNREFUSED/);
  });

  it("rate limits one client with a 429 that is not cached", async () => {
    const headers = { "x-real-ip": "203.0.113.9" };
    for (let i = 0; i < PUBLIC_RATE_LIMIT_MAX_REQUESTS; i += 1) expect((await route.GET(get(headers))).status).toBe(200);

    const limited = await route.GET(get(headers));

    expect(limited.status).toBe(429);
    expect(limited.headers.get("Cache-Control")).toBe("no-store");
    expect((await route.GET(get({ "x-real-ip": "198.51.100.1" }))).status).toBe(200);
  });
});

describe("OPTIONS /api/public/content", () => {
  it("answers the preflight for an allowlisted origin", () => {
    const response = route.OPTIONS(get({ origin: LANDING }));

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(LANDING);
  });
});
