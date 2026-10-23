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

export async function middleware(request: NextRequest): Promise<NextResponse> {
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
// guarded until its path is added here. `/api/health` and `/api/public/*`
// stay public by not being listed.
export const config = {
  matcher: ["/", "/admin/:path*"],
};
