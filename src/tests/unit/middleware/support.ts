import { SignJWT } from "jose";
import { NextRequest } from "next/server";

import { AUTH_COOKIE_NAME } from "@/infrastructure/auth/session-jwt";

export const TEST_SECRET = "z".repeat(32);

export function buildRequest(path: string, cookieValue?: string): NextRequest {
  const headers = new Headers();

  if (cookieValue !== undefined) {
    headers.set("cookie", `${AUTH_COOKIE_NAME}=${cookieValue}`);
  }

  return new NextRequest(new URL(path, "http://localhost:3000"), { headers });
}

export async function signTestToken(expiresInSeconds: number, secret: string = TEST_SECRET): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  return new SignJWT({ sub: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setExpirationTime(now + expiresInSeconds)
    .sign(new TextEncoder().encode(secret));
}

/**
 * Mirrors how Next.js compiles a matcher entry: a bare entry such as "/"
 * matches that exact path, and `/prefix/:path*` matches `/prefix` itself plus
 * everything below it.
 */
export function pathMatchesPattern(pattern: string, path: string): boolean {
  if (pattern.endsWith("/:path*")) {
    const base = pattern.slice(0, -"/:path*".length);

    return path === base || path.startsWith(`${base}/`);
  }

  return path === pattern;
}

export function matcherCovers(matcher: readonly string[], path: string): boolean {
  return matcher.some((pattern) => pathMatchesPattern(pattern, path));
}
