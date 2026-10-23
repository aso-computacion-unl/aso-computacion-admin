import "server-only";
import type { NextRequest } from "next/server";

/**
 * Sentinel client key used when no client IP header is available.
 */
const UNKNOWN_CLIENT_KEY = "unknown";

function nonEmpty(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();

  return trimmed ? trimmed : undefined;
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
 * Falls back to a constant sentinel key when neither header is usable. This
 * is the single source of truth for client identification, shared by the
 * public rate limiter and the admin login throttle.
 */
export function clientKeyFromHeaders(headers: Pick<Headers, "get">): string {
  const realIp = nonEmpty(headers.get("x-real-ip"));

  if (realIp) {
    return realIp;
  }

  const firstForwardedHop = headers
    .get("x-forwarded-for")
    ?.split(",")
    .map(nonEmpty)
    .find((hop) => hop !== undefined);

  return firstForwardedHop ?? UNKNOWN_CLIENT_KEY;
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
