import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { executeMock, cookiesMock, reportErrorMock } = vi.hoisted(() => ({ executeMock: vi.fn(), cookiesMock: vi.fn(), reportErrorMock: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: cookiesMock, headers: vi.fn() }));
vi.mock("@/infrastructure/observability/report-error", () => ({ reportError: reportErrorMock }));
vi.mock("@/interface/public/public-content-container", () => ({
  getPublicContentUseCase: () => ({ execute: executeMock }),
}));

import { NotFoundError } from "@/application/use-cases/use-case-error";
import { ValidationError } from "@/domain";
import { DEPLOY_HOOK_DEBOUNCE_MS } from "@/infrastructure/deploy/deploy-hook";
import { PUBLIC_RATE_LIMIT_MAX_REQUESTS } from "@/infrastructure/http/rate-limiter";

import { HttpError } from "@/interface/errors/http-error";

// A fresh route module per test: the rate limiter keeps its state in the module.
let route: typeof import("../../../../../app/api/public/content/route");

const LANDING = "https://aso-computacion.pages.dev";
const emptySnapshot = { events: [], faqs: [], pillars: [], socials: [], board: [], settings: null, news: [], commands: [] };

function get(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("https://admin.test/api/public/content", { headers });
}

beforeEach(async () => {
  executeMock.mockReset();
  executeMock.mockResolvedValue(emptySnapshot);
  vi.stubEnv("PUBLIC_CORS_ORIGINS", LANDING);
  vi.resetModules();
  route = await import("../../../../../app/api/public/content/route");
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

    expect(Object.keys(body).sort()).toEqual(["board", "commands", "events", "faqs", "generatedAt", "news", "pillars", "schemaVersion", "settings", "socials", "version"]);
    expect(body).toMatchObject({ version: 1, schemaVersion: 1, settings: null, events: [], board: [] });
    expect(Number.isNaN(Date.parse(body.generatedAt))).toBe(false);
  });

  it("is cacheable for a short while at the edge but never served stale to a build", async () => {
    const cacheControl = (await route.GET(get())).headers.get("Cache-Control");

    expect(cacheControl).toBe("public, max-age=0, s-maxage=5, must-revalidate");
    expect(cacheControl).not.toMatch(/stale-while-revalidate/);
  });

  it("keeps every pre-existing field and shape: schemaVersion is the only addition", async () => {
    executeMock.mockResolvedValue({ ...emptySnapshot, faqs: [{ question: "¿Cuesta?", answer: "No.", command: null }] });

    const { schemaVersion, ...rest } = await (await route.GET(get())).json();

    expect(schemaVersion).toBe(1);
    expect(rest).toMatchObject({ version: 1, faqs: [{ question: "¿Cuesta?", answer: "No.", command: null }], settings: null });
    expect(Object.keys(rest).sort()).toEqual(["board", "commands", "events", "faqs", "generatedAt", "news", "pillars", "settings", "socials", "version"]);
  });

  it("sends a strong ETag that stays put while the content does and moves when it changes", async () => {
    const first = await route.GET(get());
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = await route.GET(get());
    executeMock.mockResolvedValue({ ...emptySnapshot, faqs: [{ question: "¿Cuesta?", answer: "No.", command: null }] });
    const changed = await route.GET(get());

    expect(first.headers.get("ETag")).toMatch(/^"[0-9a-f]{64}"$/);
    expect(second.headers.get("ETag")).toBe(first.headers.get("ETag"));
    expect(changed.headers.get("ETag")).not.toBe(first.headers.get("ETag"));
  });

  it("answers a matching If-None-Match with a bodyless 304 that keeps ETag, Cache-Control, Vary and CORS", async () => {
    const etag = (await route.GET(get())).headers.get("ETag") as string;

    const response = await route.GET(get({ "if-none-match": etag, origin: LANDING }));

    expect(response.status).toBe(304);
    expect(await response.text()).toBe("");
    expect(response.headers.get("ETag")).toBe(etag);
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=0, s-maxage=5, must-revalidate");
    expect(response.headers.get("Vary")).toBe("Origin");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(LANDING);
  });

  it("answers a stale If-None-Match with the full 200 body", async () => {
    const response = await route.GET(get({ "if-none-match": '"stale"' }));

    expect(response.status).toBe(200);
    expect((await response.json()).schemaVersion).toBe(1);
  });

  it("keeps the edge TTL below the deploy-hook debounce, so a hook-fired build never reads a stale copy", async () => {
    const cacheControl = (await route.GET(get())).headers.get("Cache-Control") as string;
    const sMaxAgeMs = Number(/s-maxage=(\d+)/.exec(cacheControl)?.[1]) * 1000;

    expect(sMaxAgeMs).toBeLessThan(DEPLOY_HOOK_DEBOUNCE_MS);
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

  it("answers every failure with the same generic 503 that is not cached, keeps CORS, and leaks no internals", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const failures = [
      new Error("connect ECONNREFUSED postgres://user:secret@db/aso"),
      Object.assign(new Error("Unique constraint failed on the fields: (`slug`)"), { code: "P2002" }),
      new ValidationError("title", "title is required"),
      new NotFoundError("Event 1234 not found"),
      new HttpError(409, "conflict secret"),
    ];

    for (const failure of failures) {
      executeMock.mockRejectedValueOnce(failure);

      const response = await route.GET(get({ origin: LANDING }));
      const text = await response.text();

      expect(response.status).toBe(503);
      expect(JSON.parse(text)).toEqual({ error: "Service unavailable" });
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe(LANDING);
    }

    expect(errors).toHaveBeenCalledTimes(failures.length);
    expect(reportErrorMock).toHaveBeenCalledTimes(failures.length);
  });

  it("answers a failure while building the response (not only the read) with the generic 503 too", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    executeMock.mockResolvedValue({ ...emptySnapshot, events: [null] });

    const response = await route.GET(get());

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "Service unavailable" });
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
