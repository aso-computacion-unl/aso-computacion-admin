import { createHash, timingSafeEqual } from "node:crypto";

import { requireRuntimeValue } from "@/infrastructure/config/runtime-env";

const SECRET_MIN_LENGTH = 32;

let hasReportedMissingSecret = false;

function cronSecret(env: Record<string, string | undefined>): string | undefined {
  try {
    const secret = requireRuntimeValue("CRON_SECRET", env.CRON_SECRET).trim();

    return secret.length >= SECRET_MIN_LENGTH ? secret : undefined;
  } catch {
    return undefined;
  }
}

const digest = (value: string) => createHash("sha256").update(value).digest();

/**
 * True only for `Authorization: Bearer <CRON_SECRET>`, the header Vercel Cron sends on its own when the project
 * has a `CRON_SECRET` variable. Fails closed: with no usable secret (unset, placeholder, under 32 characters)
 * nobody is authorized, never everybody. The comparison is constant time over fixed-size digests, and the
 * secret is only ever read from the header, never from the URL.
 */
export function isAuthorizedCron(request: Request, env: Record<string, string | undefined> = process.env): boolean {
  const secret = cronSecret(env);

  if (!secret) {
    if (!hasReportedMissingSecret) {
      hasReportedMissingSecret = true;
      console.error("CRON_SECRET must be set to at least 32 characters: the scheduled rebuild endpoint refuses every request.");
    }

    return false;
  }

  const [scheme, token] = (request.headers.get("authorization") ?? "").split(" ");

  return scheme === "Bearer" && token !== undefined && timingSafeEqual(digest(token), digest(secret));
}
