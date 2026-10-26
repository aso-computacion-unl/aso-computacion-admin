import { SignJWT, jwtVerify } from "jose";

import { requireRuntimeValue } from "@/infrastructure/config/runtime-env";

/** Request header that carries the token. A header, never a URL: URLs end up in access logs and error reports. */
export const PREVIEW_TOKEN_HEADER = "x-preview-token";

/** The lifetimes an Editor or Admin can pick. Nothing outside this menu is signed, and nothing longer is accepted. */
export const PREVIEW_TOKEN_TTL_SECONDS = { "1h": 3600, "24h": 86400, "7d": 604800 } as const;
export type PreviewTokenLifetime = keyof typeof PREVIEW_TOKEN_TTL_SECONDS;

const SECRET_MIN_LENGTH = 32;
const ALGORITHM = "HS256";
const AUDIENCE = "aso-public-preview";
const ISSUER = "aso-admin";
const MAX_LIFETIME_SECONDS = PREVIEW_TOKEN_TTL_SECONDS["7d"];

type Env = Record<string, string | undefined>;

export class PreviewSecretError extends Error {
  constructor() {
    super("PREVIEW_TOKEN_SECRET must be at least 32 characters and different from ADMIN_SECRET, FORUM_SESSION_SECRET and CRON_SECRET.");
    this.name = "PreviewSecretError";
  }
}

function envValue(env: Env, name: string): string | undefined {
  try {
    return requireRuntimeValue(name, env[name]);
  } catch {
    return undefined;
  }
}

/**
 * The signing key, or undefined when it is missing, a placeholder, too short, or equal to another secret of
 * the app: one leaked secret must never be able to mint tokens for another purpose.
 */
function previewSecret(env: Env): Uint8Array | undefined {
  const secret = envValue(env, "PREVIEW_TOKEN_SECRET");
  const others = [envValue(env, "ADMIN_SECRET"), envValue(env, "FORUM_SESSION_SECRET"), envValue(env, "CRON_SECRET")];

  return secret && secret.length >= SECRET_MIN_LENGTH && !others.includes(secret) ? new TextEncoder().encode(secret) : undefined;
}

/** True when preview tokens can be signed and verified at all. */
export function isPreviewConfigured(env: Env = process.env): boolean {
  return previewSecret(env) !== undefined;
}

/** A signed, expiring token. Stateless: nothing is stored, so it cannot be revoked before it expires (rotate the secret to do so). */
export async function signPreviewToken(
  lifetime: PreviewTokenLifetime,
  now: Date = new Date(),
  env: Env = process.env,
): Promise<{ token: string; expiresAt: Date }> {
  const seconds = PREVIEW_TOKEN_TTL_SECONDS[lifetime];

  if (seconds === undefined) {
    throw new Error("Unsupported preview token lifetime.");
  }

  const secret = previewSecret(env);

  if (!secret) {
    throw new PreviewSecretError();
  }

  const issuedAt = Math.floor(now.getTime() / 1000);
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: ALGORITHM })
    .setAudience(AUDIENCE)
    .setIssuer(ISSUER)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + seconds)
    .sign(secret);

  return { token, expiresAt: new Date((issuedAt + seconds) * 1000) };
}

/**
 * Whether `token` is one this app signed for previews and has not expired at `now` (expired from the expiry
 * instant itself). Every failure, including a missing secret, is simply `false`: the caller never learns why.
 */
export async function verifyPreviewToken(token: string, now: Date = new Date(), env: Env = process.env): Promise<boolean> {
  const secret = previewSecret(env);

  if (!secret || !token) {
    return false;
  }

  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: [ALGORITHM],
      audience: AUDIENCE,
      issuer: ISSUER,
      requiredClaims: ["exp", "iat"],
      currentDate: now,
    });

    return payload.exp! - payload.iat! <= MAX_LIFETIME_SECONDS;
  } catch {
    return false;
  }
}
