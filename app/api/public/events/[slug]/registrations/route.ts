import { NextRequest, NextResponse } from "next/server";

import { ValidationError } from "@/domain/domain-error";
import { assertSlug } from "@/domain/slug";
import { getPublicClientKey } from "@/infrastructure/http/client-ip";
import { handlePreflight, withCors } from "@/infrastructure/http/cors";
import { checkRegistrationRateLimit } from "@/infrastructure/http/registration-rate-limiter";
import { verifyTurnstile } from "@/infrastructure/http/turnstile";
import { reportError } from "@/infrastructure/observability/report-error";
import { describeError, toSafeError } from "@/infrastructure/observability/safe-error";
import { requestOpenRegistration } from "@/interface/event-registration/open-registration-request";
import { readJsonObject } from "@/interface/public/read-json-body";

// A write: never prerendered, never cached.
export const dynamic = "force-dynamic";

/** Five small text fields and a token fit in far less; anything bigger is not this form. */
const MAX_BODY_BYTES = 4096;

const REFUSALS = {
  not_found: 404,
  closed: 409,
  full: 409,
  duplicate: 409,
} as const;

function answer(request: Request, body: object, status: number, headers: Record<string, string> = {}): NextResponse {
  const response = NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });

  return withCors(request, response);
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
 * Open-form registration for an event. Order matters and is cheapest first: rate limit, shape of the request,
 * Turnstile, then the request (which validates the fields strictly, makes sure an email can go out, stores the
 * registration PENDING and sends the confirmation link; the seat is only taken when the link is used). A refusal
 * leaves what is stored as it was, and the answer never echoes what was sent.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }): Promise<NextResponse> {
  const rate = checkRegistrationRateLimit(getPublicClientKey(request));

  if (!rate.allowed) {
    return answer(request, { error: "rate_limited" }, 429, { "Retry-After": String(rate.retryAfterSeconds) });
  }

  const { slug } = await params;

  if (!isSlug(slug)) {
    return answer(request, { error: "not_found" }, 404);
  }

  const body = await readJsonObject(request, MAX_BODY_BYTES);

  if (!body.ok) {
    return answer(request, { error: body.status === 413 ? "too_large" : body.status === 415 ? "unsupported_media_type" : "bad_request" }, body.status);
  }

  const captcha = await verifyTurnstile(body.value.turnstileToken);

  if (captcha === "invalid") {
    return answer(request, { error: "captcha" }, 400);
  }

  if (captcha === "unavailable") {
    return answer(request, { error: "unavailable" }, 503);
  }

  try {
    const outcome = await requestOpenRegistration({ slug, form: body.value });

    if (outcome.status === "check_email") {
      return answer(request, { ok: true, confirm: "email" }, 201);
    }

    return outcome.status === "refused" ? answer(request, { error: outcome.reason }, REFUSALS[outcome.reason]) : answer(request, { error: outcome.status }, 503);
  } catch (error) {
    if (error instanceof ValidationError) {
      return answer(request, { error: "validation", field: error.field }, 400);
    }

    // Anything else is the server's fault: never echo it. A database error can repeat the submitted name and
    // email, so neither the log nor the report gets the error itself, only its class and code.
    console.error("Open event registration failed", describeError(error));
    reportError(toSafeError(error), { route: "public-event-registration" });

    return answer(request, { error: "unavailable" }, 503);
  }
}

export function OPTIONS(request: NextRequest): NextResponse {
  return handlePreflight(request, { methods: "POST, OPTIONS", headers: "Content-Type" });
}
