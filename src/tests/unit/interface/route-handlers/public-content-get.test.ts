import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { executeMock, socialProofMock, cookiesMock, reportErrorMock } = vi.hoisted(() => ({ executeMock: vi.fn(), socialProofMock: vi.fn(), cookiesMock: vi.fn(), reportErrorMock: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: cookiesMock, headers: vi.fn() }));
vi.mock("@/infrastructure/observability/report-error", () => ({ reportError: reportErrorMock }));
vi.mock("@/interface/public/public-content-container", () => ({
  getPublicContentUseCase: () => ({ execute: executeMock }),
  getPublicSocialProofUseCase: () => ({ execute: socialProofMock }),
}));

import { NotFoundError } from "@/application/use-cases/use-case-error";
import { ValidationError } from "@/domain";
import { DEPLOY_HOOK_DEBOUNCE_MS } from "@/infrastructure/deploy/deploy-hook";
import { PUBLIC_RATE_LIMIT_MAX_REQUESTS } from "@/infrastructure/http/rate-limiter";

import { HttpError } from "@/interface/errors/http-error";
import { toPublicContentResponse } from "@/interface/public/public-content.mapper";

// A fresh route module per test: the rate limiter keeps its state in the module.
let route: typeof import("../../../../../app/api/public/content/route");

const LANDING = "https://aso-computacion.pages.dev";
const emptySocialProof = { sponsors: [] };
const emptySnapshot = { events: [], faqs: [], pillars: [], socials: [], board: [], settings: null, news: [], commands: [] };

function get(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("https://admin.test/api/public/content", { headers });
}

beforeEach(async () => {
  executeMock.mockReset();
  executeMock.mockResolvedValue(emptySnapshot);
  socialProofMock.mockReset();
  socialProofMock.mockResolvedValue(emptySocialProof);
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

  it("reads the snapshot at the current time, so scheduled items are judged at the moment of the request", async () => {
    const before = Date.now();
    await route.GET(get());

    const [options] = executeMock.mock.calls[0] ?? [];

    expect(options.now.getTime()).toBeGreaterThanOrEqual(before);
    expect(options.now.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it("serves the versioned snapshot with the settings null when never saved", async () => {
    const body = await (await route.GET(get())).json();

    expect(Object.keys(body).sort()).toEqual(["board", "commands", "events", "faqs", "generatedAt", "news", "pillars", "schemaVersion", "settings", "socials", "sponsors", "version"]);
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

    const { schemaVersion, sponsors, ...rest } = await (await route.GET(get())).json();

    expect(schemaVersion).toBe(1);
    expect(sponsors).toEqual([]);
    expect(rest).toMatchObject({ version: 1, faqs: [{ question: "¿Cuesta?", answer: "No.", command: null }], settings: null });
    expect(Object.keys(rest).sort()).toEqual(["board", "commands", "events", "faqs", "generatedAt", "news", "pillars", "settings", "socials", "version"]);
  });

  it("builds the registration and calendar URLs from the admin's public origin (AUTH_URL), and leaves them null without it", async () => {
    const event = { slug: "taller", title: "Taller", description: null, date: "2026-11-28", datePrecision: "day", type: null, commitMessage: null, hora: null, lugar: null, para: null, featured: false, linkUrl: null, linkLabel: null, highlights: [], registrationMode: "open", registrationCapacity: 20, registrationDeadline: null, photos: [] };
    executeMock.mockResolvedValue({ ...emptySnapshot, events: [event] });

    vi.stubEnv("AUTH_URL", "https://admin.example");
    const configured = (await (await route.GET(get())).json()).events[0];
    vi.stubEnv("AUTH_URL", "");
    const unconfigured = (await (await route.GET(get())).json()).events[0];

    expect(configured).toMatchObject({ calendarUrl: "https://admin.example/api/public/events/taller/calendar.ics", registration: { mode: "open", capacity: 20, endpoint: "https://admin.example/api/public/events/taller/registrations" } });
    expect(unconfigured).toMatchObject({ calendarUrl: null, registration: { mode: "open", endpoint: null } });
  });

  it("adds the sponsors list without changing a single previous field", async () => {
    const at = { createdAt: new Date(), updatedAt: new Date() };
    const snapshot = {
      ...emptySnapshot,
      faqs: [{ id: "f1", question: "¿Cuesta?", answer: "No.", command: "costo", sortOrder: 0, isPublished: true, ...at }],
      socials: [{ id: "s1", platform: "instagram", label: "IG", handle: "@aso", url: "https://instagram.com/aso", note: null, blurb: null, sortOrder: 0, isPublished: true, ...at }],
      settings: { tagline: "T", description: "D", about: "A", updatedAt: new Date() },
    };
    executeMock.mockResolvedValue(snapshot);
    socialProofMock.mockResolvedValue({ sponsors: [] });

    const body = await (await route.GET(get())).json();
    const { sponsors } = body;
    const without = (document: Record<string, unknown>, keys: string[]) => Object.fromEntries(Object.entries(document).filter(([key]) => !keys.includes(key)));
    const expected = JSON.parse(JSON.stringify(toPublicContentResponse(snapshot as never, new Date())));

    expect(without(body, ["generatedAt", "sponsors"])).toEqual(without(expected, ["generatedAt"]));
    expect(sponsors).toEqual([]);
    expect(body).not.toHaveProperty("impact");
    expect(body).not.toHaveProperty("testimonials");
  });

  it("moves the ETag when only the social proof changes", async () => {
    const first = (await route.GET(get())).headers.get("ETag");
    socialProofMock.mockResolvedValue({ sponsors: [{ id: "s1", name: "x", logo: { url: "https://res.cloudinary.test/a.png", publicId: "aso/a", width: 600, height: 300, alt: "x" }, url: null, sortOrder: 0, isPublished: true, createdAt: new Date(), updatedAt: new Date() }] });

    expect((await route.GET(get())).headers.get("ETag")).not.toBe(first);
  });

  it("answers a failing social proof read with the same generic 503", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    socialProofMock.mockRejectedValue(new Error("connect ECONNREFUSED postgres://user:secret@db/aso"));

    const response = await route.GET(get());

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "Service unavailable" });
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
