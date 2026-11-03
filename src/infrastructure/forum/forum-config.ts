import { publicOrigin, type GoogleConfig } from "@/infrastructure/auth/auth-config";
import { requireRuntimeValue } from "@/infrastructure/config/runtime-env";

type Env = Record<string, string | undefined>;

/** Registered in Google Cloud next to the admin's own redirect URI. */
export const FORUM_GOOGLE_CALLBACK_PATH = "/foro/auth/google/callback";

const SECRET_MIN_LENGTH = 32;

function value(env: Env, name: string): string | undefined {
  try {
    return requireRuntimeValue(name, env[name]).trim();
  } catch {
    return undefined;
  }
}

/** The institutional email domain students must belong to. Unset means the forum login is off. */
export function forumAllowedDomain(env: Env = process.env): string | undefined {
  return value(env, "FORUM_ALLOWED_EMAIL_DOMAIN")?.replace(/^@/, "").toLowerCase() || undefined;
}

/**
 * The secret that signs forum cookies, or undefined when it is missing, a placeholder, too short or
 * the same as `ADMIN_SECRET`: one leaked secret must never be able to sign both kinds of cookie.
 */
export function forumSessionSecret(env: Env = process.env): string | undefined {
  const secret = value(env, "FORUM_SESSION_SECRET");

  return secret && secret.length >= SECRET_MIN_LENGTH && secret !== value(env, "ADMIN_SECRET") ? secret : undefined;
}

/**
 * The Google client for the forum: the admin's by default, or a separate one when both
 * `FORUM_GOOGLE_CLIENT_ID` and `FORUM_GOOGLE_CLIENT_SECRET` are set. Null when there is none, or no
 * valid public base URL to build the redirect URI from.
 */
export function forumGoogleConfig(env: Env = process.env): GoogleConfig | null {
  if (!forumAllowedDomain(env) || !forumSessionSecret(env)) {
    return null;
  }

  const own = { id: value(env, "FORUM_GOOGLE_CLIENT_ID"), secret: value(env, "FORUM_GOOGLE_CLIENT_SECRET") };
  const clientId = own.id && own.secret ? own.id : value(env, "GOOGLE_CLIENT_ID");
  const clientSecret = own.id && own.secret ? own.secret : value(env, "GOOGLE_CLIENT_SECRET");
  const origin = publicOrigin(value(env, "AUTH_URL"));

  return clientId && clientSecret && origin ? { clientId, clientSecret, redirectUri: `${origin}${FORUM_GOOGLE_CALLBACK_PATH}` } : null;
}

export function isForumEnabled(env: Env = process.env): boolean {
  return forumGoogleConfig(env) !== null;
}

/** The variables to fix while the forum is not fully configured (names only, never values). */
export function forumConfigProblems(env: Env = process.env): string[] {
  const problems: string[] = [];

  if (!forumAllowedDomain(env)) problems.push("FORUM_ALLOWED_EMAIL_DOMAIN");
  if (!forumSessionSecret(env)) problems.push("FORUM_SESSION_SECRET");
  if (!value(env, "GOOGLE_CLIENT_ID") && !value(env, "FORUM_GOOGLE_CLIENT_ID")) problems.push("GOOGLE_CLIENT_ID");
  if (!value(env, "GOOGLE_CLIENT_SECRET") && !value(env, "FORUM_GOOGLE_CLIENT_SECRET")) problems.push("GOOGLE_CLIENT_SECRET");
  if (!publicOrigin(value(env, "AUTH_URL"))) problems.push("AUTH_URL");

  return problems;
}
