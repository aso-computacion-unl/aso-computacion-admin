import "server-only";

import { prisma } from "../prisma/client";

/**
 * Login throttle for the single admin credential, kept in Postgres so every
 * serverless instance sees the same counters (an in-memory map is per
 * instance on Vercel, so N instances multiplied the guesses by N).
 *
 * Exponential backoff per client key (the IP, IPv6 by /64, or the id of a known
 * device, see `known-device.ts`), never a hard lockout. The first
 * `LOGIN_FREE_ATTEMPTS` tries are free; after that the next try must wait
 * 30 s, then 60 s, 120 s... up to `LOGIN_BACKOFF_CAP_MS`. A lockout (the old
 * "5 failures, 15 minutes") lets anyone who shares the admin's IP, like a
 * campus NAT, keep the admin out for as long as they like; here the worst
 * case is a wait of at most the cap, and a different network is unaffected.
 * Someone on that NAT can still hold the IP bucket at the cap, which is why a
 * browser that already logged in has its own device bucket.
 *
 * There is deliberately no global ceiling across keys: it would let any
 * attacker lock the admin out everywhere. A botnet rotating IPs is held back
 * by the password's strength (long and random), not by this throttle.
 *
 * An attempt is spent BEFORE the password is compared (a "failure" is not
 * recorded afterwards), in one atomic statement, so parallel guesses cannot
 * all slip past a check-then-record gap. A successful login deletes the row.
 */
export const LOGIN_FREE_ATTEMPTS = 5;
export const LOGIN_BACKOFF_BASE_MS = 30 * 1000;
export const LOGIN_BACKOFF_CAP_MS = 5 * 60 * 1000;
/**
 * The doubling stops here: 30 s * 2^10 is already far past the cap, and an
 * unbounded `power(2, attempts - 5)` overflows float8 in Postgres once an
 * attacker has kept a key at the cap for ~1000 attempts (a few days).
 */
export const LOGIN_BACKOFF_MAX_EXPONENT = 10;
/** Attempts older than this are forgotten: the counter restarts and the row is purged. */
export const LOGIN_ATTEMPT_WINDOW_MS = 60 * 60 * 1000;

export interface LoginRateStatus {
  allowed: boolean;
  retryAfterSeconds: number;
}

/** How long a key must wait after having made `attempts` attempts in the window. */
export function loginDelayMs(attempts: number): number {
  if (attempts < LOGIN_FREE_ATTEMPTS) {
    return 0;
  }

  const exponent = Math.min(attempts - LOGIN_FREE_ATTEMPTS, LOGIN_BACKOFF_MAX_EXPONENT);

  return Math.min(LOGIN_BACKOFF_CAP_MS, LOGIN_BACKOFF_BASE_MS * 2 ** exponent);
}

/**
 * Spends one login attempt for `key`, atomically. Returns `allowed: false`
 * (and changes nothing, so hammering never extends the wait) while the key is
 * waiting. The SQL repeats `loginDelayMs`; the integration tests pin both.
 */
export async function consumeLoginAttempt(key: string, now: number = Date.now()): Promise<LoginRateStatus> {
  const staleBefore = now - LOGIN_ATTEMPT_WINDOW_MS;

  await prisma.$executeRaw`DELETE FROM "LoginAttempt" WHERE "lastAttemptAt" <= ${staleBefore}::bigint`;

  const spent = await prisma.$queryRaw<{ attempts: number }[]>`
    INSERT INTO "LoginAttempt" ("key", "attempts", "lastAttemptAt")
    VALUES (${key}, 1, ${now}::bigint)
    ON CONFLICT ("key") DO UPDATE SET
      "attempts" = CASE
        WHEN "LoginAttempt"."lastAttemptAt" <= ${staleBefore}::bigint THEN 1
        ELSE "LoginAttempt"."attempts" + 1
      END,
      "lastAttemptAt" = ${now}::bigint
    WHERE "LoginAttempt"."lastAttemptAt" <= ${staleBefore}::bigint
      OR "LoginAttempt"."attempts" < ${LOGIN_FREE_ATTEMPTS}::int
      OR "LoginAttempt"."lastAttemptAt"
         + LEAST(${LOGIN_BACKOFF_CAP_MS}::float8, ${LOGIN_BACKOFF_BASE_MS}::float8 * power(2, LEAST("LoginAttempt"."attempts" - ${LOGIN_FREE_ATTEMPTS}::int, ${LOGIN_BACKOFF_MAX_EXPONENT}::int)))
         <= ${now}::bigint
    RETURNING "attempts"
  `;

  if (spent.length > 0) {
    return { allowed: true, retryAfterSeconds: 0 };
  }

  const waiting = await prisma.loginAttempt.findUnique({ where: { key } });

  if (!waiting) {
    // The row vanished between the two statements (a successful login cleared it): nothing to wait for.
    return { allowed: true, retryAfterSeconds: 0 };
  }

  const retryAt = Number(waiting.lastAttemptAt) + loginDelayMs(waiting.attempts);

  return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((retryAt - now) / 1000)) };
}

export async function recordSuccessfulLogin(key: string): Promise<void> {
  await prisma.loginAttempt.deleteMany({ where: { key } });
}

let hasReportedUnknownLoginClient = false;

/**
 * No client IP header means we are not behind Vercel (local development, a bare
 * `next start`) or a proxy is not forwarding it. Every such request shares the
 * one "unknown" bucket: safe, because it is throttled like any other key, but
 * it means everyone behind it slows each other down. Said once per process.
 */
export function reportUnknownLoginClient(): void {
  if (hasReportedUnknownLoginClient) {
    return;
  }

  hasReportedUnknownLoginClient = true;
  console.warn(
    'No client IP header on a login request (not running behind Vercel?): every such request shares one "unknown" throttle bucket.',
  );
}

/** Test-only helper to re-arm the report-once latch. */
export function resetUnknownLoginClientReport(): void {
  hasReportedUnknownLoginClient = false;
}
