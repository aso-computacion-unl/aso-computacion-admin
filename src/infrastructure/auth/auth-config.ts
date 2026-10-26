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
function publicOrigin(raw: string | undefined): string | undefined {
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

/**
 * The shared-password emergency login. On while Google is not configured (local development, and
 * production until Google is set up), then only with the explicit flag. Turning it off also makes
 * the guard reject every break-glass session that is still open.
 */
export function isBreakGlassEnabled(env: Env = process.env): boolean {
  return env.BREAK_GLASS_PASSWORD_LOGIN === "1" || !isGoogleConfigured(env);
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
