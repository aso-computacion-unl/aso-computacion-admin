import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { executeMock, cookiesMock, reportErrorMock } = vi.hoisted(() => ({ executeMock: vi.fn(), cookiesMock: vi.fn(), reportErrorMock: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: cookiesMock, headers: vi.fn() }));
vi.mock("@/infrastructure/observability/report-error", () => ({ reportError: reportErrorMock }));
vi.mock("@/interface/public/public-content-container", () => ({
  getPublicContentUseCase: () => ({ execute: executeMock }),
}));

import { PUBLIC_RATE_LIMIT_MAX_REQUESTS } from "@/infrastructure/http/rate-limiter";
import { PREVIEW_TOKEN_HEADER, signPreviewToken } from "@/infrastructure/preview/preview-token";

// A fresh route module per test: the rate limiter keeps its state in the module.
let route: typeof import("../../../../../app/api/public/preview/route");

const emptySnapshot = { events: [], faqs: [], pillars: [], socials: [], board: [], settings: null, news: [], commands: [] };

function get(token?: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("https://admin.test/api/public/preview", { headers: token === undefined ? headers : { ...headers, [PREVIEW_TOKEN_HEADER]: token } });
}

beforeEach(async () => {
  executeMock.mockReset();
  executeMock.mockResolvedValue(emptySnapshot);
  vi.stubEnv("ADMIN_SECRET", "a".repeat(40));
  vi.stubEnv("PREVIEW_TOKEN_SECRET", "p".repeat(40));
  vi.resetModules();
  route = await import("../../../../../app/api/public/preview/route");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("GET /api/public/preview", () => {
  it("never reads content without a token: 401, nothing fetched, nothing cacheable", async () => {
    const response = await route.GET(get());

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Invalid or expired preview token" });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(executeMock).not.toHaveBeenCalled();
  });

  it("refuses an expired token, a forged one and an empty one the same way, without reading content", async () => {
    const expired = (await signPreviewToken("1h", new Date(Date.now() - 2 * 3600 * 1000))).token;
    const [header, payload, signature] = (await signPreviewToken("1h")).token.split(".") as [string, string, string];

    // Change the first character: all six of its bits count. Overwriting the last two with "AA" is a no-op
    // whenever the signature already ends in "AA", and the last character carries unused padding bits.
    const forgedSignature = `${signature[0] === "A" ? "B" : "A"}${signature.slice(1)}`;
    expect(forgedSignature).not.toBe(signature);

    for (const token of [expired, `${header}.${payload}.${forgedSignature}`, "garbage", ""]) {
      const response = await route.GET(get(token));

      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: "Invalid or expired preview token" });
      expect(response.headers.get("Cache-Control")).toBe("no-store");
    }

    expect(executeMock).not.toHaveBeenCalled();
  });

  it("refuses every token while PREVIEW_TOKEN_SECRET is not configured", async () => {
    const { token } = await signPreviewToken("1h");
    vi.stubEnv("PREVIEW_TOKEN_SECRET", "");

    expect((await route.GET(get(token))).status).toBe(401);
    expect(executeMock).not.toHaveBeenCalled();
  });

  it("does not take the token from the URL or from a cookie", async () => {
    const { token } = await signPreviewToken("1h");

    expect((await route.GET(new NextRequest(`https://admin.test/api/public/preview?token=${token}&preview=${token}`))).status).toBe(401);
    expect((await route.GET(get(undefined, { cookie: `preview=${token}` }))).status).toBe(401);
    expect(executeMock).not.toHaveBeenCalled();
  });

  it("with a valid token reads the unpublished and scheduled content, marks the document as a preview and never lets it be cached", async () => {
    executeMock.mockResolvedValue({ ...emptySnapshot, faqs: [{ question: "Borrador", answer: "a", command: null }] });
    const { token } = await signPreviewToken("1h");

    const response = await route.GET(get(token));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(executeMock).toHaveBeenCalledWith(expect.objectContaining({ includeUnpublished: true }));
    expect(body).toMatchObject({ preview: true, schemaVersion: 1, faqs: [{ question: "Borrador" }] });
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("ETag")).toBeNull();
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(cookiesMock).not.toHaveBeenCalled();
  });

  it("answers a failure with the same generic uncacheable 503 and leaks no token", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    executeMock.mockRejectedValue(new Error("connect ECONNREFUSED postgres://user:secret@db/aso"));
    const { token } = await signPreviewToken("1h");

    const response = await route.GET(get(token));
    const text = await response.text();

    expect(response.status).toBe(503);
    expect(JSON.parse(text)).toEqual({ error: "Service unavailable" });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(JSON.stringify([...vi.mocked(console.error).mock.calls, ...reportErrorMock.mock.calls])).not.toContain(token);
  });

  it("rate limits guessing: a client past the public budget gets a 429 before any token is looked at", async () => {
    const headers = { "x-real-ip": "203.0.113.9" };
    for (let i = 0; i < PUBLIC_RATE_LIMIT_MAX_REQUESTS; i += 1) expect((await route.GET(get("bad", headers))).status).toBe(401);

    const limited = await route.GET(get("bad", headers));

    expect(limited.status).toBe(429);
    expect(limited.headers.get("Cache-Control")).toBe("no-store");
  });

  it("is rendered per request and only reads: GET is the only verb", () => {
    expect(route.dynamic).toBe("force-dynamic");
    expect(Object.keys(route).filter((name) => /^[A-Z]+$/.test(name))).toEqual(["GET"]);
  });
});
