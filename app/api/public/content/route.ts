import { NextRequest, NextResponse } from "next/server";

import { publicOrigin } from "@/infrastructure/auth/auth-config";
import { getPublicClientKey } from "@/infrastructure/http/client-ip";
import { handlePreflight, withCors } from "@/infrastructure/http/cors";
import { ifNoneMatchMatches, strongEtag } from "@/infrastructure/http/etag";
import { reportError } from "@/infrastructure/observability/report-error";
import { checkPublicRateLimit } from "@/infrastructure/http/rate-limiter";
import { getPublicContentUseCase, getPublicSocialProofUseCase } from "@/interface/public/public-content-container";
import type { PublicContentResponse } from "@/interface/public/public-content.dto";
import { toPublicContentResponse } from "@/interface/public/public-content.mapper";
import type { PublicSocialProof } from "@/interface/public/public-social-proof.dto";
import { toPublicSocialProof } from "@/interface/public/public-social-proof.mapper";

// Read from Postgres on every request: never prerendered at build time.
export const dynamic = "force-dynamic";

/**
 * The consumer is the landing's build, which runs right after a mutation (the
 * deploy hook waits longer than 5 s before firing). So the edge may collapse a
 * burst of reads for 5 s, but must never serve a stale copy: no
 * stale-while-revalidate, and browsers always revalidate.
 *
 * COUPLING: the `s-maxage` below must stay strictly shorter than
 * `DEPLOY_HOOK_DEBOUNCE_MS` (src/infrastructure/deploy/deploy-hook.ts). If it
 * grew past the debounce, a build fired by the hook could read a copy from
 * before the edit. Raise one and you must check the other.
 */
const PUBLIC_CONTENT_CACHE_CONTROL = "public, max-age=0, s-maxage=5, must-revalidate";

/**
 * `generatedAt` is the moment of the read and changes on every request, so it is left out of the hash:
 * the ETag then changes exactly when the content does, and a 304 lets the caller keep its copy
 * (and the `generatedAt` that came with it).
 */
function withoutGeneratedAt(body: PublicContentResponse): Record<string, unknown> {
  return Object.fromEntries(Object.entries(body).filter(([key]) => key !== "generatedAt"));
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const rate = checkPublicRateLimit(getPublicClientKey(request));

  if (!rate.allowed) {
    const limited = NextResponse.json({ error: "Too Many Requests" }, { status: 429 });
    limited.headers.set("Cache-Control", "no-store");
    limited.headers.set("Retry-After", String(rate.retryAfterSeconds));

    return withCors(request, limited);
  }

  try {
    const now = new Date();
    const [snapshot, socialProof] = await Promise.all([getPublicContentUseCase().execute({ now }), getPublicSocialProofUseCase().execute()]);
    // S9 social proof is appended after every existing key: the main document is built, and shaped, exactly as before.
    const body: PublicContentResponse & PublicSocialProof = {
      ...toPublicContentResponse(snapshot, now, { adminOrigin: publicOrigin(process.env.AUTH_URL) }),
      ...toPublicSocialProof(socialProof),
    };
    const etag = strongEtag(JSON.stringify(withoutGeneratedAt(body)));
    // 304 and 200 share these headers: a 304 must repeat the ones that would have been on the 200.
    const headers = { "Cache-Control": PUBLIC_CONTENT_CACHE_CONTROL, ETag: etag };

    if (ifNoneMatchMatches(request.headers.get("if-none-match"), etag)) {
      return withCors(request, new NextResponse(null, { status: 304, headers }));
    }

    return withCors(request, NextResponse.json(body, { status: 200, headers }));
  } catch (error) {
    // Anything that fails here is the server's fault, never the caller's: the admin error mapper
    // would turn a validation/not-found/conflict error into a 4xx that echoes internal wording.
    console.error("Public content failed", error);
    reportError(error, { route: "public-content" });

    const failure = NextResponse.json({ error: "Service unavailable" }, { status: 503 });
    failure.headers.set("Cache-Control", "no-store");

    return withCors(request, failure);
  }
}

export function OPTIONS(request: NextRequest): NextResponse {
  return handlePreflight(request);
}
