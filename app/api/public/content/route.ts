import { NextRequest, NextResponse } from "next/server";

import { getPublicClientKey } from "@/infrastructure/http/client-ip";
import { handlePreflight, withCors } from "@/infrastructure/http/cors";
import { checkPublicRateLimit } from "@/infrastructure/http/rate-limiter";
import { mapErrorToResponse } from "@/interface/errors/map-error-to-response";
import { getPublicContentUseCase } from "@/interface/public/public-content-container";
import { toPublicContentResponse } from "@/interface/public/public-content.mapper";

// Read from Postgres on every request: never prerendered at build time.
export const dynamic = "force-dynamic";

/**
 * The consumer is the landing's build, which runs right after a mutation (the
 * deploy hook waits longer than 5 s before firing). So the edge may collapse a
 * burst of reads for 5 s, but must never serve a stale copy: no
 * stale-while-revalidate, and browsers always revalidate.
 */
const PUBLIC_CONTENT_CACHE_CONTROL = "public, max-age=0, s-maxage=5, must-revalidate";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const rate = checkPublicRateLimit(getPublicClientKey(request));

  if (!rate.allowed) {
    const limited = NextResponse.json({ error: "Too Many Requests" }, { status: 429 });
    limited.headers.set("Cache-Control", "no-store");
    limited.headers.set("Retry-After", String(rate.retryAfterSeconds));

    return withCors(request, limited);
  }

  try {
    const snapshot = await getPublicContentUseCase().execute();
    const response = NextResponse.json(toPublicContentResponse(snapshot, new Date()), { status: 200 });
    response.headers.set("Cache-Control", PUBLIC_CONTENT_CACHE_CONTROL);

    return withCors(request, response);
  } catch (error) {
    const failure = mapErrorToResponse(error);
    failure.headers.set("Cache-Control", "no-store");

    return withCors(request, failure);
  }
}

export function OPTIONS(request: NextRequest): NextResponse {
  return handlePreflight(request);
}
