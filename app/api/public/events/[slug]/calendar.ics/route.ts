import { NextRequest, NextResponse } from "next/server";

import { publicOrigin } from "@/infrastructure/auth/auth-config";
import { getPublicClientKey } from "@/infrastructure/http/client-ip";
import { handlePreflight, withCors } from "@/infrastructure/http/cors";
import { checkPublicRateLimit } from "@/infrastructure/http/rate-limiter";
import { reportError } from "@/infrastructure/observability/report-error";
import { isEventSlug } from "@/interface/event-registration/public-event-route";
import { buildEventIcs } from "@/interface/public/event-ics";
import { registrationPageUrl } from "@/interface/public/public-event-extras";
import { getEventRegistrationServices } from "@/interface/public/event-registration-container";

// Read from Postgres on every request: never prerendered.
export const dynamic = "force-dynamic";

/** The file only changes when the event is edited; a minute at the edge spares the database a burst of identical reads. */
const CACHE_CONTROL = "public, max-age=0, s-maxage=60, must-revalidate";

function failure(request: Request, status: number, error: string, headers: Record<string, string> = {}): NextResponse {
  return withCors(request, NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store", ...headers } }));
}

/**
 * The public `.ics` download of one event (the "add to calendar" link). No session, no personal data: the file
 * holds the event's own data only. Only an event that is public right now and has an exact day has one.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }): Promise<NextResponse> {
  const rate = checkPublicRateLimit(getPublicClientKey(request));

  if (!rate.allowed) {
    return failure(request, 429, "Too Many Requests", { "Retry-After": String(rate.retryAfterSeconds) });
  }

  const { slug } = await params;

  if (!isEventSlug(slug)) {
    return failure(request, 404, "Not found");
  }

  try {
    const event = await getEventRegistrationServices().publicEvent.execute({ slug, now: new Date() });
    const url = event?.registrationMode === "unl" ? registrationPageUrl(slug, publicOrigin(process.env.AUTH_URL)) : null;
    const ics = event && buildEventIcs(event, { url });

    if (!ics) {
      return failure(request, 404, "Not found");
    }

    return withCors(
      request,
      new NextResponse(ics, {
        status: 200,
        headers: {
          "Content-Type": "text/calendar; charset=utf-8",
          "Content-Disposition": `attachment; filename="${slug}.ics"`,
          "Cache-Control": CACHE_CONTROL,
        },
      }),
    );
  } catch (error) {
    console.error("Event calendar failed", error);
    reportError(error, { route: "public-event-calendar" });

    return failure(request, 503, "Service unavailable");
  }
}

export function OPTIONS(request: NextRequest): NextResponse {
  return handlePreflight(request);
}
