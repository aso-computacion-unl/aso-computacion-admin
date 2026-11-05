import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import {
  AUTH_COOKIE_NAME,
  getSessionSecret,
  reportSessionSecretMisconfiguration,
  SessionSecretError,
  verifySession,
} from "@/infrastructure/auth/session-jwt";

function isApiRequest(request: NextRequest): boolean {
  return request.nextUrl.pathname.startsWith("/api/");
}

// `/api/admin/` has no routes yet and is not in the matcher; it is listed so that a future admin API added
// to the matcher is guarded by the existing 401 JSON / 503 logic instead of silently passing through.
function isProtectedPathname(pathname: string): boolean {
  return pathname === "/" || pathname === "/admin" || pathname.startsWith("/admin/") || pathname.startsWith("/api/admin/");
}

// Next 16 runs the matcher and finds the page on the decoded path as well, and it treats a decoded backslash as a
// slash: `/%61dmin`, `/admin%2Fevents` and `/%5Cadmin` all reach an admin page. Guard the raw path and its decoded
// form, both with backslashes read as slashes and repeated slashes collapsed.
function normalizePath(pathname: string): string {
  return pathname.replace(/[\\/]+/g, "/");
}

function isProtectedPath(pathname: string): boolean {
  return isProtectedPathname(normalizePath(pathname)) || isProtectedPathname(normalizePath(decodeURIComponent(pathname)));
}

function isDecodablePath(pathname: string): boolean {
  try {
    decodeURIComponent(pathname);

    return true;
  } catch (error) {
    if (error instanceof URIError) {
      return false;
    }

    throw error;
  }
}

function badRequest(request: NextRequest): NextResponse {
  if (!isApiRequest(request)) {
    return new NextResponse("<h1>Bad request</h1>", {
      status: 400,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  return NextResponse.json({ error: "Bad request" }, { status: 400 });
}

function denyAccess(request: NextRequest): NextResponse {
  if (!isApiRequest(request)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function serviceUnavailable(request: NextRequest): NextResponse {
  if (!isApiRequest(request)) {
    return new NextResponse("<h1>Service unavailable</h1>", {
      status: 503,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // Next 16 no longer maps a malformed percent escape to 400 on dynamic routes (it throws DecodeError, a 500),
  // so the answer is given here, before the session secret or any route is touched.
  if (!isDecodablePath(pathname)) {
    return badRequest(request);
  }

  if (!isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  try {
    getSessionSecret();
  } catch (error) {
    if (error instanceof SessionSecretError) {
      reportSessionSecretMisconfiguration();
      return serviceUnavailable(request);
    }

    throw error;
  }

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;

  if (!token) {
    return denyAccess(request);
  }

  let result;

  try {
    result = await verifySession(token);
  } catch (error) {
    if (error instanceof SessionSecretError) {
      reportSessionSecretMisconfiguration();
      return serviceUnavailable(request);
    }

    throw error;
  }

  if (!result.valid) {
    return denyAccess(request);
  }

  return NextResponse.next();
}

// The matcher is an allowlist: a new protected route or admin API is NOT
// guarded until its path is added here AND `isProtectedPath` accepts it.
// It also lists the dynamic public prefixes (`/foro`, `/invitacion`,
// `/api/public/events`), but only for the undecodable-path check above: auth
// is decided by `isProtectedPath`, so those requests pass through untouched.
// `/login`, `/api/health` and `/api/public/content` stay outside it.
// The last entry sends every path with an encoded (`%5C`) or literal backslash to the proxy: Next 16 reads a
// decoded backslash as a slash, but none of the other entries match `/%5Cadmin`, so without it the session check
// would be skipped for those spellings of `/` and `/admin`.
export const config = {
  matcher: ["/", "/admin/:path*", "/foro/:path+", "/invitacion/:path+", "/api/public/events/:path+", "/(.*(?:%5[Cc]|\\\\).*)"],
};
