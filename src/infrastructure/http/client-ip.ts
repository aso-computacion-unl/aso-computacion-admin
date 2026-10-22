import "server-only";
import type { NextRequest } from "next/server";

/**
 * Sentinel client key used when no client IP header is available.
 */
export const UNKNOWN_CLIENT_KEY = "unknown";

function nonEmpty(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();

  return trimmed ? trimmed : undefined;
}

const IPV4_PATTERN = /^\d{1,3}(\.\d{1,3}){3}$/;
const HEXTET_PATTERN = /^[0-9a-f]{1,4}$/i;

/** The eight 16-bit groups of an IPv6 address, or `null` when `address` is not one. */
function parseIpv6(address: string): number[] | null {
  let text = address;
  const tail = text.slice(text.lastIndexOf(":") + 1);

  // An embedded IPv4 tail (`::ffff:203.0.113.5`) stands for the last two groups.
  if (IPV4_PATTERN.test(tail)) {
    const octets = tail.split(".").map(Number);

    if (octets.some((octet) => octet > 255)) {
      return null;
    }

    const high = ((octets[0] ?? 0) << 8) | (octets[1] ?? 0);
    const low = ((octets[2] ?? 0) << 8) | (octets[3] ?? 0);
    text = `${text.slice(0, text.length - tail.length)}${high.toString(16)}:${low.toString(16)}`;
  }

  const halves = text.split("::");

  if (halves.length > 2) {
    return null;
  }

  const toGroups = (part: string) => (part === "" ? [] : part.split(":"));
  const head = toGroups(halves[0] ?? "");
  const rest = toGroups(halves[1] ?? "");
  const missing = 8 - head.length - rest.length;

  if (halves.length === 1 ? missing !== 0 : missing < 1) {
    return null;
  }

  const groups = [...head, ...Array<string>(halves.length === 2 ? missing : 0).fill("0"), ...rest];

  if (groups.length !== 8 || !groups.every((group) => HEXTET_PATTERN.test(group))) {
    return null;
  }

  return groups.map((group) => parseInt(group, 16));
}

/**
 * IPv6 clients are keyed by their /64: a customer or campus owns the whole
 * prefix, so a per-address key would let one client rotate through 2^64
 * addresses and never meet a throttle. IPv4 and IPv4-mapped IPv6 addresses
 * (`::ffff:a.b.c.d`, which are IPv4 clients, not a /64 of their own) are kept
 * as they came, and so is anything that does not parse.
 */
function throttleKeyForIp(ip: string): string {
  if (!ip.includes(":")) {
    return ip;
  }

  const groups = parseIpv6(ip.replace(/^\[|\]$/g, "").replace(/%.*$/, ""));

  if (!groups) {
    return ip;
  }

  const isIpv4Mapped = groups.slice(0, 5).every((group) => group === 0) && groups[5] === 0xffff;

  if (isIpv4Mapped) {
    return ip;
  }

  return `${groups.slice(0, 4).map((group) => group.toString(16)).join(":")}::/64`;
}

/**
 * Resolves a per-client key for rate limiting on Vercel.
 *
 * Vercel overwrites `x-forwarded-for` and `x-real-ip` with the IP of the
 * connecting client, so a value forged by the client never reaches the app
 * (https://vercel.com/docs/headers/request-headers). That is why the
 * resolution is `x-real-ip` first, then the FIRST `x-forwarded-for` entry.
 *
 * This is only safe behind Vercel. On a platform that appends to a
 * client-supplied `x-forwarded-for`, the first entry is attacker-controlled
 * and this function must be revisited (the rightmost hop is the trusted one
 * behind a single appending proxy).
 *
 * An IPv6 client is keyed by its /64 prefix (see `throttleKeyForIp`).
 *
 * Falls back to a constant sentinel key when neither header is usable. This
 * is the single source of truth for client identification, shared by the
 * public rate limiter and the admin login throttle.
 */
export function clientKeyFromHeaders(headers: Pick<Headers, "get">): string {
  const realIp = nonEmpty(headers.get("x-real-ip"));

  if (realIp) {
    return throttleKeyForIp(realIp);
  }

  const firstForwardedHop = headers
    .get("x-forwarded-for")
    ?.split(",")
    .map(nonEmpty)
    .find((hop) => hop !== undefined);

  return firstForwardedHop ? throttleKeyForIp(firstForwardedHop) : UNKNOWN_CLIENT_KEY;
}

/**
 * Best-effort per-client identifier for rate limiting on a fully public,
 * unauthenticated endpoint.
 *
 * There is no lower-level fallback available: `NextRequest` (App Router, Node
 * runtime) exposes no raw connection/remote-address API in this Next.js
 * version, so a "connection remote address" fallback is not reachable from a
 * route handler and is not attempted.
 */
export function getPublicClientKey(request: NextRequest): string {
  return clientKeyFromHeaders(request.headers);
}
