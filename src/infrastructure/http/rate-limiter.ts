import "server-only";

/**
 * Fixed-window, per-key request throttle for a fully public endpoint.
 * Modeled on the login rate limiter's in-memory approach
 * (`src/infrastructure/auth/login-rate-limiter.ts`) but counts every
 * request within a window rather than only failures.
 *
 * State is per-process and in-memory: a first line of defence, not a
 * distributed limiter. Behind multiple instances each replica throttles
 * independently; cache headers on the public read API are the primary
 * control against public read-load abuse.
 */
export const PUBLIC_RATE_LIMIT_MAX_REQUESTS = 60;
export const PUBLIC_RATE_LIMIT_WINDOW_MS = 60 * 1000;

interface WindowRecord {
  count: number;
  windowStart: number;
}

const windows = new Map<string, WindowRecord>();

export interface RateLimitStatus {
  allowed: boolean;
  retryAfterSeconds: number;
}

export function checkPublicRateLimit(key: string, now: number = Date.now()): RateLimitStatus {
  const record = windows.get(key);

  if (!record || now - record.windowStart >= PUBLIC_RATE_LIMIT_WINDOW_MS) {
    windows.set(key, { count: 1, windowStart: now });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (record.count >= PUBLIC_RATE_LIMIT_MAX_REQUESTS) {
    const retryAfterSeconds = Math.ceil((record.windowStart + PUBLIC_RATE_LIMIT_WINDOW_MS - now) / 1000);

    return { allowed: false, retryAfterSeconds };
  }

  record.count += 1;

  return { allowed: true, retryAfterSeconds: 0 };
}

/** Test-only helper to clear all throttle state between suites. */
export function resetPublicRateLimiter(): void {
  windows.clear();
}
