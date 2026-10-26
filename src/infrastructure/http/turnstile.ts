import "server-only";

import { reportError } from "../observability/report-error";
import { requireRuntimeValue } from "../config/runtime-env";

export const TURNSTILE_SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
export const TURNSTILE_SECRET_ENV_VAR = "TURNSTILE_SECRET_KEY";

/** Cloudflare documents tokens of up to 2048 characters; anything longer is not one. */
const TOKEN_MAX_LENGTH = 2048;
const VERIFY_TIMEOUT_MS = 5000;
/** Answers that mean OUR configuration is wrong, not that the visitor failed: the form must not stay open to bots meanwhile. */
const CONFIGURATION_ERRORS = new Set(["missing-input-secret", "invalid-input-secret", "internal-error"]);

/** `valid`: a human (as far as Cloudflare can tell). `invalid`: the visitor failed. `unavailable`: cannot decide, so refuse (fail closed). */
export type TurnstileResult = "valid" | "invalid" | "unavailable";

export interface TurnstileOptions {
  env?: Record<string, string | undefined>;
  fetch?: typeof globalThis.fetch;
}

function configuredSecret(env: Record<string, string | undefined>): string | undefined {
  try {
    return requireRuntimeValue(TURNSTILE_SECRET_ENV_VAR, env[TURNSTILE_SECRET_ENV_VAR]).trim();
  } catch {
    return undefined;
  }
}

let reportedMissingSecret = false;

/**
 * Verifies a Cloudflare Turnstile token server-side. It fails closed: a missing secret in production, an
 * unreachable Cloudflare, a bad answer or a misconfigured secret all return `unavailable`, never `valid`.
 * Outside production a missing secret skips the check, so the form can be tried locally without a Cloudflare
 * account (Cloudflare also publishes always-pass test keys for that).
 */
export async function verifyTurnstile(token: unknown, { env = process.env, fetch: send = globalThis.fetch }: TurnstileOptions = {}): Promise<TurnstileResult> {
  const secret = configuredSecret(env);

  if (!secret) {
    if (env.NODE_ENV !== "production") {
      return "valid";
    }

    if (!reportedMissingSecret) {
      reportedMissingSecret = true;
      console.error(`${TURNSTILE_SECRET_ENV_VAR} is not configured; event registration through the open form is closed.`);
    }

    return "unavailable";
  }

  if (typeof token !== "string" || token.trim() === "" || token.length > TOKEN_MAX_LENGTH) {
    return "invalid";
  }

  try {
    const response = await send(TURNSTILE_SITEVERIFY_URL, {
      method: "POST",
      body: new URLSearchParams({ secret, response: token.trim() }),
      signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
      cache: "no-store",
    });

    if (!response.ok) {
      return "unavailable";
    }

    const answer = (await response.json()) as { success?: unknown; "error-codes"?: unknown };

    if (answer.success === true) {
      return "valid";
    }

    const codes = Array.isArray(answer["error-codes"]) ? answer["error-codes"] : [];

    return answer.success === false && !codes.some((code) => typeof code === "string" && CONFIGURATION_ERRORS.has(code)) ? "invalid" : "unavailable";
  } catch (error) {
    console.error("Turnstile could not be verified.");
    reportError(error, { action: "turnstile-verify" });

    return "unavailable";
  }
}
