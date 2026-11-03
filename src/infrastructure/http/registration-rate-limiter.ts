import "server-only";

import { FixedWindowRateLimiter, type RateLimitStatus } from "./rate-limiter";

/**
 * A write endpoint needs a far tighter budget than the cached read API: a person registers once, so a few
 * attempts per client every ten minutes is generous. Same best-effort caveat as the read limiter (the counters
 * live in one serverless instance): the hard limits are Turnstile, the unique email and the capacity.
 */
export const REGISTRATION_RATE_LIMIT_MAX_REQUESTS = 5;
export const REGISTRATION_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
export const REGISTRATION_RATE_LIMIT_MAX_TRACKED_CLIENTS = 10_000;

export const registrationRateLimiter = new FixedWindowRateLimiter({
  maxRequests: REGISTRATION_RATE_LIMIT_MAX_REQUESTS,
  windowMs: REGISTRATION_RATE_LIMIT_WINDOW_MS,
  maxKeys: REGISTRATION_RATE_LIMIT_MAX_TRACKED_CLIENTS,
});

export function checkRegistrationRateLimit(key: string, now: number = Date.now()): RateLimitStatus {
  return registrationRateLimiter.check(key, now);
}
