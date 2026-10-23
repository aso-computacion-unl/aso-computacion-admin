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

// A residential or campus IPv6 customer owns a whole /64, so a /128 key would
// let one client rotate through 2^64 addresses and never meet the login throttle.
describe("clientKeyFromHeaders (IPv6 /64)", () => {
  const key = (ip: string) => clientKeyFromHeaders(new Headers({ "x-real-ip": ip }));

  it("keys an IPv6 client by its /64 prefix", () => {
    expect(key("2001:db8:1:2:aaaa:bbbb:cccc:dddd")).toBe("2001:db8:1:2::/64");
  });

  it("gives every address of one /64 the same key", () => {
    const keys = new Set(
      ["2001:db8:1:2::1", "2001:db8:1:2:ffff:ffff:ffff:ffff", "2001:0DB8:0001:0002:0:0:0:9", "2001:db8:1:2::"].map(key),
    );

    expect(keys).toEqual(new Set(["2001:db8:1:2::/64"]));
  });

  it("separates different /64 prefixes", () => {
    expect(key("2001:db8:1:2::1")).not.toBe(key("2001:db8:1:3::1"));
    expect(key("2001:db8:1:2::1")).not.toBe(key("2001:db8:2:2::1"));
  });

  it("expands :: before cutting the prefix, wherever it appears", () => {
    expect(key("2001:db8::1")).toBe("2001:db8:0:0::/64");
    expect(key("::1")).toBe("0:0:0:0::/64");
    expect(key("::")).toBe("0:0:0:0::/64");
    expect(key("fe80::1ff:fe23:4567:890a")).toBe("fe80:0:0:0::/64");
    expect(key("1:2:3:4:5:6:7::")).toBe("1:2:3:4::/64");
  });

  it("ignores a zone id and surrounding brackets", () => {
    expect(key("fe80::1%eth0")).toBe("fe80:0:0:0::/64");
    expect(key("[2001:db8:1:2::1]")).toBe("2001:db8:1:2::/64");
  });

  it("applies to the x-forwarded-for fallback too", () => {
    const headers = new Headers({ "x-forwarded-for": "2001:db8:1:2::77, 10.0.0.1" });

    expect(clientKeyFromHeaders(headers)).toBe("2001:db8:1:2::/64");
  });

  it("leaves IPv4 untouched", () => {
    expect(key("203.0.113.5")).toBe("203.0.113.5");
  });

  it.each(["::ffff:203.0.113.5", "::FFFF:203.0.113.5", "::ffff:cb00:7105", "0:0:0:0:0:ffff:203.0.113.5"])(
    "leaves the IPv4-mapped address %s untouched (one /64 would put every mapped client in one bucket)",
    (ip) => {
      expect(key(ip)).toBe(ip);
    },
  );

  it("keeps different IPv4-mapped clients apart", () => {
    expect(key("::ffff:203.0.113.5")).not.toBe(key("::ffff:203.0.113.6"));
  });

  it("returns a value it cannot parse as it came", () => {
    expect(key("not-an-ip:at:all")).toBe("not-an-ip:at:all");
  });
});
