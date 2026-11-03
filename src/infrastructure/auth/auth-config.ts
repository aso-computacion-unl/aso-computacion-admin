import { requireRuntimeValue } from "@/infrastructure/config/runtime-env";

type Env = Record<string, string | undefined>;

export const GOOGLE_CALLBACK_PATH = "/auth/google/callback";

export interface GoogleConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

function value(env: Env, name: string): string | undefined {
  try {
    return requireRuntimeValue(name, env[name]).trim();
  } catch {
    return undefined;
  }
}

/** The public origin of the admin: https, or plain http only on localhost for development. */
export function publicOrigin(raw: string | undefined): string | undefined {
  if (!raw) {
    return undefined;
  }

  try {
    const url = new URL(raw);
    const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";

    return url.protocol === "https:" || (url.protocol === "http:" && isLocal) ? url.origin : undefined;
  } catch {
    return undefined;
  }
}

/** Null unless the client id, the client secret and a valid public base URL are all set. */
export function googleConfig(env: Env = process.env): GoogleConfig | null {
  const clientId = value(env, "GOOGLE_CLIENT_ID");
  const clientSecret = value(env, "GOOGLE_CLIENT_SECRET");
  const origin = publicOrigin(value(env, "AUTH_URL"));

  return clientId && clientSecret && origin ? { clientId, clientSecret, redirectUri: `${origin}${GOOGLE_CALLBACK_PATH}` } : null;
}

export function isGoogleConfigured(env: Env = process.env): boolean {
  return googleConfig(env) !== null;
}

const GOOGLE_VARIABLES = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "AUTH_URL"] as const;
const GOOGLE_CLIENT_VARIABLES = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"] as const;

/**
 * The variables to fix when the Google setup is half done. Only the client id and secret say "Google is
 * being set up": neither set is a deliberate "no Google" (empty list), either set without the whole being
 * valid is a mistake. AUTH_URL alone is not a Google signal, because invitations, preview links and
 * registration links need it too. Only names, never values.
 */
export function googleConfigProblems(env: Env = process.env): string[] {
  if (GOOGLE_CLIENT_VARIABLES.every((name) => value(env, name) === undefined) || googleConfig(env)) {
    return [];
  }

  return GOOGLE_VARIABLES.filter((name) => (name === "AUTH_URL" ? !publicOrigin(value(env, name)) : value(env, name) === undefined));
}

/**
 * The shared-password emergency login. Implicitly on only when neither Google client variable is set
 * (local development, and production until Google is set up; AUTH_URL alone does not count). Once Google is configured, or half
 * configured (an error that must not silently re-open the password), only the explicit flag turns it
 * on. Turning it off also makes the guard reject every break-glass session that is still open.
 */
export function isBreakGlassEnabled(env: Env = process.env): boolean {
  return env.BREAK_GLASS_PASSWORD_LOGIN === "1" || (!isGoogleConfigured(env) && googleConfigProblems(env).length === 0);
}

/** What `/login` offers: Google, the password form, and the configuration problems to tell the operator about. */
export function loginAvailability(env: Env = process.env): { google: boolean; emergency: boolean; problems: string[] } {
  return { google: isGoogleConfigured(env), emergency: isBreakGlassEnabled(env), problems: googleConfigProblems(env) };
}

export function bootstrapEmails(env: Env = process.env): string[] {
  return (env.ADMIN_BOOTSTRAP_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);
}

export function allowedEmailDomain(env: Env = process.env): string | undefined {
  return env.ALLOWED_EMAIL_DOMAIN?.trim() || undefined;
}
