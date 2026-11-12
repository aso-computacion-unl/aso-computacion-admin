import { NextRequest, NextResponse } from "next/server";

import { assertSlug } from "@/domain/slug";
import { getPublicClientKey } from "@/infrastructure/http/client-ip";
import { checkRegistrationRateLimit } from "@/infrastructure/http/registration-rate-limiter";
import { reportError } from "@/infrastructure/observability/report-error";
import { describeError, toSafeError } from "@/infrastructure/observability/safe-error";
import { openRegistrationConfirmToken } from "@/infrastructure/registration/registration-confirm-token";
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
  mode_mismatch: 404,
  closed: 409,
  full: 409,
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
 * Confirms the email of a pending open registration and takes its seat. Only a POST does: the link in the email opens
 * a page whose button sends this request, because mail scanners and link previews fetch every link with GET and must
 * not be able to confirm anything. The token proves the link is ours and names the attempt it was issued for (only the
 * latest link of an email works, D9); whether the seat is still free (capacity, deadline, the 48 h window) is decided
 * atomically by the repository. A refusal leaves the registration as it was.
 * Same-origin only: no CORS, no Turnstile (the token is the secret), its own rate-limit budget per client.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }): Promise<NextResponse> {
  const rate = checkRegistrationRateLimit(`confirm:${getPublicClientKey(request)}`);

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
    const token = await openRegistrationConfirmToken(typeof body.value.token === "string" ? body.value.token : undefined);

    if (token.status !== "valid") {
      return answer({ error: token.status }, REFUSALS[token.status]);
    }

    const outcome = await getEventRegistrationServices().confirmOpen.execute({
      slug,
      eventId: token.claims.eventId,
      registrationId: token.claims.registrationId,
      nonce: token.claims.nonce ?? null,
    });

    if (outcome.status === "confirmed" || outcome.status === "already_confirmed") {
      return answer({ ok: true, status: outcome.status }, 200);
    }

    return answer({ error: outcome.status === "mode_mismatch" ? "not_found" : outcome.status }, REFUSALS[outcome.status]);
  } catch (error) {
    // Never echo it: only the class and code reach the log and the report.
    console.error("Open registration confirmation failed", describeError(error));
    reportError(toSafeError(error), { route: "public-event-registration-confirm" });

    return answer({ error: "unavailable" }, 503);
  }
}
