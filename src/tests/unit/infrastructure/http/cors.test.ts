import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { NextResponse } from "next/server";

// A fresh module per test: the "reported once" latch for invalid origins lives in the module.
let handlePreflight: typeof import("@/infrastructure/http/cors").handlePreflight;
let parseAllowedOrigins: typeof import("@/infrastructure/http/cors").parseAllowedOrigins;
let withCors: typeof import("@/infrastructure/http/cors").withCors;

const LANDING = "https://aso-computacion.pages.dev";
const request = (origin?: string) => new Request("https://admin.test/api/public/content", { headers: origin ? { origin } : {} });

beforeEach(async () => {
  vi.resetModules();
  ({ handlePreflight, parseAllowedOrigins, withCors } = await import("@/infrastructure/http/cors"));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("parseAllowedOrigins", () => {
  it("splits a comma-separated list, trimming blanks and ignoring empty entries", () => {
    expect(parseAllowedOrigins(` ${LANDING} , https://aso.example ,, `)).toEqual([LANDING, "https://aso.example"]);
  });

  it("is empty when unset or blank", () => {
    expect(parseAllowedOrigins(undefined)).toEqual([]);
    expect(parseAllowedOrigins("  ")).toEqual([]);
  });

  it.each([
    ["a wildcard", "*"],
    ["a wildcard subdomain", "https://*.pages.dev"],
    ["a trailing slash", `${LANDING}/`],
    ["a path", `${LANDING}/content`],
    ["a query", `${LANDING}?x=1`],
    ["a non-http scheme", "ftp://aso.example"],
    ["plain http on a public host", "http://aso.example"],
    ["a bare host", "aso.example"],
    ["credentials", "https://user:pw@aso.example"],
    ["garbage", "not a url"],
    ["a mixed-case host (browsers send it lower-case)", "https://ASO.example"],
  ])("ignores %s and logs it once", (_label, entry) => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(parseAllowedOrigins(`${entry},${LANDING}`)).toEqual([LANDING]);
    parseAllowedOrigins(`${entry},${LANDING}`);

    expect(log).toHaveBeenCalledTimes(1);
  });

  it("allows plain http only for loopback hosts, with or without a port", () => {
    expect(parseAllowedOrigins("http://localhost:4321,http://127.0.0.1:4321,http://localhost")).toEqual([
      "http://localhost:4321",
      "http://127.0.0.1:4321",
      "http://localhost",
    ]);
  });
});

describe("withCors", () => {
  it("echoes an allowlisted origin exactly and varies on Origin", () => {
    vi.stubEnv("PUBLIC_CORS_ORIGINS", `${LANDING},https://aso.example`);

    const response = withCors(request("https://aso.example"), NextResponse.json({}));

    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://aso.example");
    expect(response.headers.get("Vary")).toBe("Origin");
  });

  it("sends no allow-origin to another origin, a lookalike, another port or no Origin, and still varies on Origin", () => {
    vi.stubEnv("PUBLIC_CORS_ORIGINS", LANDING);

    for (const origin of ["https://evil.example", `${LANDING}.evil.example`, "https://aso-computacion.pages.dev:8443", "null", undefined]) {
      const response = withCors(request(origin), NextResponse.json({}));

      expect(response.headers.get("Access-Control-Allow-Origin"), String(origin)).toBeNull();
      expect(response.headers.get("Vary")).toBe("Origin");
    }
  });

  it("denies everyone when PUBLIC_CORS_ORIGINS is unset, and never answers with a wildcard", () => {
    const response = withCors(request(LANDING), NextResponse.json({}));

    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();

    vi.stubEnv("PUBLIC_CORS_ORIGINS", "*");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(withCors(request("https://evil.example"), NextResponse.json({})).headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("keeps an existing Vary value and never allows credentials", () => {
    vi.stubEnv("PUBLIC_CORS_ORIGINS", LANDING);
    const response = NextResponse.json({});
    response.headers.set("Vary", "Accept-Encoding");

    const result = withCors(request(LANDING), response);

    expect(result.headers.get("Vary")).toBe("Accept-Encoding, Origin");
    expect(result.headers.get("Access-Control-Allow-Credentials")).toBeNull();
  });
});

describe("handlePreflight", () => {
  it("answers an allowlisted origin with 204, the allowed method and a max age", () => {
    vi.stubEnv("PUBLIC_CORS_ORIGINS", LANDING);

    const response = handlePreflight(request(LANDING));

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(LANDING);
    expect(response.headers.get("Access-Control-Allow-Methods")).toBe("GET, OPTIONS");
    expect(response.headers.get("Access-Control-Max-Age")).toBe("86400");
    expect(response.headers.get("Vary")).toBe("Origin");
    expect(response.headers.get("Access-Control-Allow-Credentials")).toBeNull();
  });

  it("answers any other origin with a bare 204 that grants nothing", () => {
    vi.stubEnv("PUBLIC_CORS_ORIGINS", LANDING);

    const response = handlePreflight(request("https://evil.example"));

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(response.headers.get("Access-Control-Allow-Methods")).toBeNull();
    expect(response.headers.get("Vary")).toBe("Origin");
  });
});
