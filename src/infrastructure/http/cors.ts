import "server-only";
import { NextResponse } from "next/server";

export const PUBLIC_CORS_ORIGINS_ENV_VAR = "PUBLIC_CORS_ORIGINS";

const PREFLIGHT_MAX_AGE_SECONDS = 86400;
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

let hasReportedInvalidOrigins = false;

/** Test-only helper: resets the "reported once" latch for invalid allowlist entries. */
export function resetCorsConfigurationReport(): void {
  hasReportedInvalidOrigins = false;
}

/**
 * An entry is usable only as an exact origin, exactly as a browser sends it:
 * `https://host[:port]` (plain `http` only for loopback, for local development),
 * with no path, query, credentials or wildcard. Anything else is ignored, so a
 * typo narrows access instead of widening it.
 */
function isExactOrigin(entry: string): boolean {
  let url: URL;

  // `new URL` accepts `*` in a host, so a wildcard has to be refused by hand.
  if (entry.includes("*")) {
    return false;
  }

  try {
    url = new URL(entry);
  } catch {
    return false;
  }

  const isHttps = url.protocol === "https:";
  const isLoopbackHttp = url.protocol === "http:" && LOOPBACK_HOSTS.has(url.hostname);

  return (isHttps || isLoopbackHttp) && url.origin === entry;
}

/** Parses the comma-separated `PUBLIC_CORS_ORIGINS` into its exact origins; invalid entries are dropped and logged once. */
export function parseAllowedOrigins(raw: string | undefined): string[] {
  const entries = (raw ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry !== "");
  const invalid = entries.filter((entry) => !isExactOrigin(entry));

  if (invalid.length > 0 && !hasReportedInvalidOrigins) {
    hasReportedInvalidOrigins = true;
    console.error(
      `${PUBLIC_CORS_ORIGINS_ENV_VAR} ignores entries that are not an exact origin (https://host[:port], no path or wildcard): ${invalid.join(", ")}`,
    );
  }

  return entries.filter((entry) => !invalid.includes(entry));
}

function grantedOrigin(request: Request): string | undefined {
  const origin = request.headers.get("origin");

  return origin !== null && parseAllowedOrigins(process.env[PUBLIC_CORS_ORIGINS_ENV_VAR]).includes(origin) ? origin : undefined;
}

/**
 * Echoes the request's origin only when it is on the allowlist (never `*`), and
 * always sends `Vary: Origin`: the answer depends on the request, so a shared
 * cache must not hand one origin's headers to another. No credentials header:
 * the endpoint is public and never reads cookies.
 */
export function withCors(request: Request, response: NextResponse): NextResponse {
  const origin = grantedOrigin(request);
  const vary = response.headers.get("Vary");

  if (origin) {
    response.headers.set("Access-Control-Allow-Origin", origin);
  }

  if (!vary?.split(",").some((value) => value.trim().toLowerCase() === "origin")) {
    response.headers.set("Vary", vary ? `${vary}, Origin` : "Origin");
  }

  return response;
}

/** An origin off the allowlist gets a bare 204 that grants nothing, so its browser blocks the request. */
export function handlePreflight(request: Request): NextResponse {
  const response = new NextResponse(null, { status: 204 });

  if (grantedOrigin(request)) {
    response.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    response.headers.set("Access-Control-Max-Age", String(PREFLIGHT_MAX_AGE_SECONDS));
  }

  return withCors(request, response);
}
