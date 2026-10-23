import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { clientKeyFromHeaders, getPublicClientKey } from "@/infrastructure/http/client-ip";

function buildRequest(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(new URL("http://localhost:3000/api/public/events"), {
    headers: new Headers(headers),
  });
}

// Vercel overwrites `x-forwarded-for` and `x-real-ip` with the connecting
// client's IP, so neither header can carry a value forged by the client.
// https://vercel.com/docs/headers/request-headers
describe("getPublicClientKey (Vercel)", () => {
  it("prefers x-real-ip over x-forwarded-for", () => {
    const request = buildRequest({
      "x-real-ip": "198.51.100.20",
      "x-forwarded-for": "203.0.113.7",
    });

    expect(getPublicClientKey(request)).toBe("198.51.100.20");
  });

  it("ignores a multi-hop spoofed x-forwarded-for when x-real-ip is present", () => {
    const request = buildRequest({
      "x-real-ip": "198.51.100.20",
      "x-forwarded-for": "6.6.6.6, 7.7.7.7, 8.8.8.8",
    });

    expect(getPublicClientKey(request)).toBe("198.51.100.20");
  });

  it("keeps the same key for one client while the spoofed hops rotate", () => {
    const keys = ["1.1.1.1", "2.2.2.2, 3.3.3.3", "4.4.4.4, 5.5.5.5, 6.6.6.6"].map((spoofed) =>
      getPublicClientKey(buildRequest({ "x-real-ip": "198.51.100.20", "x-forwarded-for": spoofed })),
    );

    expect(new Set(keys)).toEqual(new Set(["198.51.100.20"]));
  });

  it("falls back to the FIRST x-forwarded-for entry when x-real-ip is absent", () => {
    const request = buildRequest({ "x-forwarded-for": "203.0.113.7, 10.0.0.5, 198.51.100.20" });

    expect(getPublicClientKey(request)).toBe("203.0.113.7");
  });

  it("uses the single value when x-forwarded-for has only one entry", () => {
    const request = buildRequest({ "x-forwarded-for": "203.0.113.7" });

    expect(getPublicClientKey(request)).toBe("203.0.113.7");
  });

  it("trims whitespace and skips empty entries in x-forwarded-for", () => {
    const request = buildRequest({ "x-forwarded-for": " , 203.0.113.7 ,  198.51.100.20  " });

    expect(getPublicClientKey(request)).toBe("203.0.113.7");
  });

  it("skips a blank x-real-ip and uses x-forwarded-for", () => {
    const request = buildRequest({ "x-real-ip": "   ", "x-forwarded-for": "203.0.113.7" });

    expect(getPublicClientKey(request)).toBe("203.0.113.7");
  });

  it("falls back to a constant sentinel key when both headers are missing", () => {
    expect(getPublicClientKey(buildRequest())).toBe("unknown");
  });

  it("falls back to the sentinel key when both headers are present but empty", () => {
    const request = buildRequest({ "x-real-ip": "", "x-forwarded-for": "" });

    expect(getPublicClientKey(request)).toBe("unknown");
  });
});

describe("clientKeyFromHeaders", () => {
  it("resolves the same key from a plain Headers object", () => {
    const headers = new Headers({ "x-real-ip": "198.51.100.20", "x-forwarded-for": "6.6.6.6, 7.7.7.7" });

    expect(clientKeyFromHeaders(headers)).toBe("198.51.100.20");
  });

  it("returns the sentinel key when no client header is present", () => {
    expect(clientKeyFromHeaders(new Headers())).toBe("unknown");
  });
});
