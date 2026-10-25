import "server-only";

/**
 * Fixed-window, per-key request throttle for a fully public endpoint.
 * Modeled on the login rate limiter's in-memory approach
 * (`src/infrastructure/auth/login-rate-limiter.ts`) but counts every
 * request within a window rather than only failures.
 *
 * BEST EFFORT, NOT A GUARANTEE. The counters live in the memory of one
 * serverless instance. Vercel runs many instances and recycles them at will,
 * so the counts are neither shared nor durable: a client spread over several
 * instances, or one that waits for a cold start, gets a fresh budget each time.
 * This guard only stops a single client hammering a single warm instance.
 *
 * The real protection of the public read API is the CDN cache
 * (`Cache-Control: s-maxage` on the route): a flood of identical GETs is
 * answered at the edge and never reaches Postgres. Do not rely on this limiter
 * for anything the cache does not already cover. Making it truly global would
 * need a shared store (Redis, the database), which the cache makes unnecessary.
 *
 * The map is bounded: records of elapsed windows are swept once per window,
 * and at most `maxKeys` clients are tracked (the oldest is evicted first), so
 * a flood of distinct addresses cannot grow the process without limit.
 */
export const PUBLIC_RATE_LIMIT_MAX_REQUESTS = 60;
export const PUBLIC_RATE_LIMIT_WINDOW_MS = 60 * 1000;
export const PUBLIC_RATE_LIMIT_MAX_TRACKED_CLIENTS = 10_000;

interface WindowRecord {
  count: number;
  windowStart: number;
}

export interface RateLimitStatus {
  allowed: boolean;
  retryAfterSeconds: number;
}

export interface FixedWindowRateLimiterOptions {
  maxRequests: number;
  windowMs: number;
  maxKeys: number;
}

export class FixedWindowRateLimiter {
  /** Insertion order is window-start order: a renewed window is re-inserted at the end. */
  private readonly windows = new Map<string, WindowRecord>();
  private lastSweep = 0;

  constructor(private readonly options: FixedWindowRateLimiterOptions) {}

  /** Number of clients currently tracked. */
  get size(): number {
    return this.windows.size;
  }

  check(key: string, now: number = Date.now()): RateLimitStatus {
    const { maxRequests, windowMs } = this.options;

    this.sweepIfDue(now);

    const record = this.windows.get(key);

    if (!record || now - record.windowStart >= windowMs) {
      this.windows.delete(key);
      this.windows.set(key, { count: 1, windowStart: now });
      this.evictOverflow(now);

      return { allowed: true, retryAfterSeconds: 0 };
    }

    if (record.count >= maxRequests) {
      const retryAfterSeconds = Math.ceil((record.windowStart + windowMs - now) / 1000);

      return { allowed: false, retryAfterSeconds };
    }

    record.count += 1;

    return { allowed: true, retryAfterSeconds: 0 };
  }

  private sweepIfDue(now: number): void {
    if (now - this.lastSweep < this.options.windowMs) return;

    this.lastSweep = now;
    this.deleteExpired(now);
  }

  private deleteExpired(now: number): void {
    for (const [key, record] of this.windows) {
      if (now - record.windowStart >= this.options.windowMs) this.windows.delete(key);
    }
  }

  private evictOverflow(now: number): void {
    if (this.windows.size <= this.options.maxKeys) return;

    this.deleteExpired(now);

    for (const key of this.windows.keys()) {
      if (this.windows.size <= this.options.maxKeys) break;
      this.windows.delete(key);
    }
  }
}

export const publicRateLimiter = new FixedWindowRateLimiter({
  maxRequests: PUBLIC_RATE_LIMIT_MAX_REQUESTS,
  windowMs: PUBLIC_RATE_LIMIT_WINDOW_MS,
  maxKeys: PUBLIC_RATE_LIMIT_MAX_TRACKED_CLIENTS,
});

export function checkPublicRateLimit(key: string, now: number = Date.now()): RateLimitStatus {
  return publicRateLimiter.check(key, now);
}
