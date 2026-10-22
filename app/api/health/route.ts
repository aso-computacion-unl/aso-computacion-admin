import { NextResponse } from "next/server";

/**
 * Liveness check only — does NOT verify DB connectivity. Requires no
 * authentication and must never expose secrets, connection strings, or
 * stack traces in its body.
 */
export function GET(): NextResponse {
  const response = NextResponse.json({ status: "ok" }, { status: 200 });

  response.headers.set("Cache-Control", "no-store");

  return response;
}
