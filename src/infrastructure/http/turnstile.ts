import "server-only";

import { reportError } from "../observability/report-error";
import { requireRuntimeValue } from "../config/runtime-env";

export const TURNSTILE_SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
export const TURNSTILE_SECRET_ENV_VAR = "TURNSTILE_SECRET_KEY";
export const TURNSTILE_SITE_KEY_ENV_VAR = "TURNSTILE_SITE_KEY";

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

// What Cloudflare issues (letters, digits, `_`, `-`); the value ends up in the page, so nothing else gets through.
const SITE_KEY_PATTERN = /^[0-9A-Za-z_-]{1,100}$/;

/**
 * The public half of the widget's key pair, read at request time so the page can render the widget without a
 * rebuild. Missing, a placeholder or oddly shaped: `undefined`, and the page renders no widget (with the secret
 * set the page closes its form, see `turnstileSecretWithoutSiteKey`).
 */
export function turnstileSiteKey(env: Record<string, string | undefined> = process.env): string | undefined {
  try {
    const key = requireRuntimeValue(TURNSTILE_SITE_KEY_ENV_VAR, env[TURNSTILE_SITE_KEY_ENV_VAR]).trim();

    return SITE_KEY_PATTERN.test(key) ? key : undefined;
  } catch {
    return undefined;
  }
}

let reportedMissingSecret = false;
let reportedMissingSiteKey = false;

/**
 * Whether the secret is configured but no usable site key is: the server then demands a token that this admin's
 * own pages cannot render a widget for, so their form can never be submitted. Verification itself does not change:
 * the server never accepts a registration without a token while the secret is set; the caller closes the page's
 * form instead. Logged once, naming the variable to set.
 */
export function turnstileSecretWithoutSiteKey(env: Record<string, string | undefined> = process.env): boolean {
  if (!configuredSecret(env) || turnstileSiteKey(env)) {
    return false;
  }

  if (!reportedMissingSiteKey) {
    reportedMissingSiteKey = true;
    console.error(`${TURNSTILE_SECRET_ENV_VAR} is set but ${TURNSTILE_SITE_KEY_ENV_VAR} is missing or invalid; the event page cannot show the Turnstile widget, so its registration form is closed. Set ${TURNSTILE_SITE_KEY_ENV_VAR} to the widget's public site key.`);
  }

  return true;
}

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
