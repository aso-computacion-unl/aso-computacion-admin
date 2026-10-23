import "server-only";

/**
 * Process-local login throttle for the single admin credential. Guards the
 * login action against online brute force: after too many failures for a
 * given client key, the key is locked out for a cooldown window.
 *
 * State is per-process and in-memory. It is a first line of defence, not a
 * distributed limiter — behind multiple instances each replica throttles
 * independently, and a restart clears the counters.
 */
export const LOGIN_MAX_FAILED_ATTEMPTS = 5;
export const LOGIN_LOCKOUT_MS = 15 * 60 * 1000;

interface AttemptRecord {
  failures: number;
  lockedUntil: number;
}

const attempts = new Map<string, AttemptRecord>();

export interface LoginRateStatus {
  allowed: boolean;
  retryAfterSeconds: number;
}

export function checkLoginRate(key: string, now: number = Date.now()): LoginRateStatus {
  const record = attempts.get(key);

  if (record && record.lockedUntil > now) {
    return { allowed: false, retryAfterSeconds: Math.ceil((record.lockedUntil - now) / 1000) };
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

export function recordFailedLogin(key: string, now: number = Date.now()): void {
  const record = attempts.get(key) ?? { failures: 0, lockedUntil: 0 };

  // Attempts made while already locked out must not extend the window.
  if (record.lockedUntil > now) {
    return;
  }

  record.failures += 1;

  if (record.failures >= LOGIN_MAX_FAILED_ATTEMPTS) {
    record.lockedUntil = now + LOGIN_LOCKOUT_MS;
    record.failures = 0;
  }

  attempts.set(key, record);
}

export function recordSuccessfulLogin(key: string): void {
  attempts.delete(key);
}

/** Test-only helper to clear all throttle state between suites. */
export function resetLoginRateLimiter(): void {
  attempts.clear();
}
