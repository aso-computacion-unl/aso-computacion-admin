import { NextRequest, NextResponse } from "next/server";

import { publicOrigin } from "@/infrastructure/auth/auth-config";
import { getPublicClientKey } from "@/infrastructure/http/client-ip";
import { checkPublicRateLimit } from "@/infrastructure/http/rate-limiter";
import { reportError } from "@/infrastructure/observability/report-error";
import { PREVIEW_TOKEN_HEADER, verifyPreviewToken } from "@/infrastructure/preview/preview-token";
import { getPublicContentUseCase } from "@/interface/public/public-content-container";
import type { PublicContentResponse } from "@/interface/public/public-content.dto";
import { toPublicContentResponse } from "@/interface/public/public-content.mapper";

// Read from Postgres on every request: never prerendered at build time.
export const dynamic = "force-dynamic";

/**
 * The same document as `/api/public/content`, plus drafts and scheduled items, for whoever holds a valid
 * preview token (generated in the admin by an Editor or Admin). Meant for a server-side preview build of the
 * landing, so it grants no CORS: a browser on another origin cannot read it.
 *
 * Nothing here may be cached or logged: the answer contains unpublished content, so it is `no-store`, and the
 * token travels in a header (never the URL) and is never written to a log or an error report.
 */
const NO_STORE = "private, no-store";

function denied(status: number, error: string, headers: Record<string, string> = {}): NextResponse {
  return NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const rate = checkPublicRateLimit(getPublicClientKey(request));

  if (!rate.allowed) {
    return denied(429, "Too Many Requests", { "Retry-After": String(rate.retryAfterSeconds) });
  }

  const now = new Date();

  if (!(await verifyPreviewToken(request.headers.get(PREVIEW_TOKEN_HEADER) ?? "", now))) {
    return denied(401, "Invalid or expired preview token");
  }

  try {
    const snapshot = await getPublicContentUseCase().execute({ now, includeUnpublished: true });
    const body: PublicContentResponse & { preview: true } = { ...toPublicContentResponse(snapshot, now, { adminOrigin: publicOrigin(process.env.AUTH_URL) }), preview: true };

    return NextResponse.json(body, { status: 200, headers: { "Cache-Control": NO_STORE } });
  } catch (error) {
    console.error("Public preview failed", error);
    reportError(error, { route: "public-preview" });

    return denied(503, "Service unavailable");
  }
}
