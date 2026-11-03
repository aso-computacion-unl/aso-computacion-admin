import { NextRequest, NextResponse } from "next/server";

import { getPublicClientKey } from "@/infrastructure/http/client-ip";
import { handleOpenPreflight, withOpenCors } from "@/infrastructure/http/cors";
import { checkPublicRateLimit } from "@/infrastructure/http/rate-limiter";
import { reportError } from "@/infrastructure/observability/report-error";
import { getEventRegistrationServices } from "@/interface/public/event-registration-container";

// Read from Postgres on every request: never prerendered at build time.
export const dynamic = "force-dynamic";

/**
 * The same policy as the content API: the edge may collapse a burst of reads for 5 s, never serve a stale copy,
 * and browsers always revalidate. A seat count that is a few seconds old is fine; the server decides on submit.
 * COUPLING: keep `s-maxage` in step with `PUBLIC_CONTENT_CACHE_CONTROL` in `app/api/public/content/route.ts`.
 */
const SEATS_CACHE_CONTROL = "public, max-age=0, s-maxage=5, must-revalidate";

function answer(body: object, status: number, headers: Record<string, string>): NextResponse {
  return withOpenCors(NextResponse.json(body, { status, headers }));
}

/**
 * The seats of every publicly visible event that takes registrations: counts and slugs, no personal data, so
 * any origin may read it. Same visibility and closing rules as the registration itself.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const rate = checkPublicRateLimit(getPublicClientKey(request));

  if (!rate.allowed) {
    return answer({ error: "Too Many Requests" }, 429, { "Cache-Control": "no-store", "Retry-After": String(rate.retryAfterSeconds) });
  }

  try {
    const events = await getEventRegistrationServices().seats.execute({ now: new Date() });

    return answer({ events }, 200, { "Cache-Control": SEATS_CACHE_CONTROL });
  } catch (error) {
    // Whatever fails here is the server's fault: a generic answer, nothing of the cause.
    console.error("Public event seats failed", error);
    reportError(error, { route: "public-event-seats" });

    return answer({ error: "Service unavailable" }, 503, { "Cache-Control": "no-store" });
  }
}

export function OPTIONS(): NextResponse {
  return handleOpenPreflight();
}
