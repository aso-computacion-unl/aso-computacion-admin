import { NextRequest, NextResponse } from "next/server";

import { assertSlug } from "@/domain/slug";
import { getPublicClientKey } from "@/infrastructure/http/client-ip";
import { checkRegistrationRateLimit } from "@/infrastructure/http/registration-rate-limiter";
import { reportError } from "@/infrastructure/observability/report-error";
import { describeError, toSafeError } from "@/infrastructure/observability/safe-error";
import { openRegistrationCancelToken } from "@/infrastructure/registration/registration-cancel-token";
import { getEventRegistrationServices } from "@/interface/public/event-registration-container";
import { readJsonObject } from "@/interface/public/read-json-body";

// A write: never prerendered, never cached.
export const dynamic = "force-dynamic";

/** A signed token and nothing else: far less than this is a real one. */
const MAX_BODY_BYTES = 2048;

const REFUSALS = {
  invalid: 400,
  expired: 410,
  not_found: 404,
  closed: 409,
} as const;

function answer(body: object, status: number, headers: Record<string, string> = {}): NextResponse {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

function isSlug(value: string): boolean {
  try {
    assertSlug(value);

    return true;
  } catch {
    return false;
  }
}

/**
 * Cancels a registration (D7) with the link of its confirmation or reminder email: deletes the row, which frees its
 * seat. Only a POST does: the link opens a page whose button sends this request, because mail scanners and link
 * previews fetch every link with GET and must not be able to cancel anything. The token proves the link is ours and
 * names the registration; whether the event still lets it go (public, registration not closed) is decided atomically by
 * the repository, and a refusal leaves everything as it was. A registration that is already gone answers
 * `already_cancelled`: only someone holding a link we signed can ask, so it reveals nothing about any other address.
 * Same-origin only: no CORS, no Turnstile (the token is the secret), its own rate-limit budget per client.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }): Promise<NextResponse> {
  const rate = checkRegistrationRateLimit(`cancel:${getPublicClientKey(request)}`);

  if (!rate.allowed) {
    return answer({ error: "rate_limited" }, 429, { "Retry-After": String(rate.retryAfterSeconds) });
  }

  const { slug } = await params;

  if (!isSlug(slug)) {
    return answer({ error: "not_found" }, 404);
  }

  const body = await readJsonObject(request, MAX_BODY_BYTES);

  if (!body.ok) {
    return answer({ error: body.status === 413 ? "too_large" : body.status === 415 ? "unsupported_media_type" : "bad_request" }, body.status);
  }

  try {
    const token = await openRegistrationCancelToken(typeof body.value.token === "string" ? body.value.token : undefined);

    if (token.status !== "valid") {
      return answer({ error: token.status }, REFUSALS[token.status]);
    }

    const outcome = await getEventRegistrationServices().cancelByLink.execute({ slug, eventId: token.claims.eventId, registrationId: token.claims.registrationId });

    if (outcome.status === "cancelled" || outcome.status === "not_registered") {
      return answer({ ok: true, status: outcome.status === "cancelled" ? "cancelled" : "already_cancelled" }, 200);
    }

    return answer({ error: outcome.status }, REFUSALS[outcome.status]);
  } catch (error) {
    // Never echo it: only the class and code reach the log and the report.
    console.error("Registration cancellation failed", describeError(error));
    reportError(toSafeError(error), { route: "public-event-registration-cancel" });

    return answer({ error: "unavailable" }, 503);
  }
}
