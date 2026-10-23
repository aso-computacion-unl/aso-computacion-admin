import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  FixedWindowRateLimiter,
  PUBLIC_RATE_LIMIT_MAX_REQUESTS,
  PUBLIC_RATE_LIMIT_WINDOW_MS,
} from "@/infrastructure/http/rate-limiter";

// A fresh module per test: the shared limiter keeps its state in the module.
let checkPublicRateLimit: typeof import("@/infrastructure/http/rate-limiter").checkPublicRateLimit;

beforeEach(async () => {
  vi.resetModules();
  ({ checkPublicRateLimit } = await import("@/infrastructure/http/rate-limiter"));
});

const KEY = "203.0.113.7";
const T0 = 1_000_000;

describe("public rate limiter", () => {
  it("allows requests up to the configured threshold within the window", () => {
    for (let i = 0; i < PUBLIC_RATE_LIMIT_MAX_REQUESTS; i += 1) {
      expect(checkPublicRateLimit(KEY, T0).allowed).toBe(true);
    }
  });

  it("blocks the request that exceeds the threshold within the window (429 boundary)", () => {
    for (let i = 0; i < PUBLIC_RATE_LIMIT_MAX_REQUESTS; i += 1) {
      checkPublicRateLimit(KEY, T0);
    }

    const status = checkPublicRateLimit(KEY, T0);
    expect(status.allowed).toBe(false);
    expect(status.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("resets the count once the window has elapsed", () => {
    for (let i = 0; i < PUBLIC_RATE_LIMIT_MAX_REQUESTS; i += 1) {
      checkPublicRateLimit(KEY, T0);
    }
    expect(checkPublicRateLimit(KEY, T0).allowed).toBe(false);

    const nextWindow = T0 + PUBLIC_RATE_LIMIT_WINDOW_MS + 1;
    expect(checkPublicRateLimit(KEY, nextWindow).allowed).toBe(true);
  });

  it("tracks keys independently (per-IP isolation)", () => {
    for (let i = 0; i < PUBLIC_RATE_LIMIT_MAX_REQUESTS; i += 1) {
      checkPublicRateLimit(KEY, T0);
    }
    expect(checkPublicRateLimit(KEY, T0).allowed).toBe(false);

    expect(checkPublicRateLimit("198.51.100.9", T0).allowed).toBe(true);
  });

  it("reports a shrinking retry-after as time passes within the same window", () => {
    for (let i = 0; i < PUBLIC_RATE_LIMIT_MAX_REQUESTS; i += 1) {
      checkPublicRateLimit(KEY, T0);
    }

    const early = checkPublicRateLimit(KEY, T0 + 1000).retryAfterSeconds;
    const later = checkPublicRateLimit(KEY, T0 + 2000).retryAfterSeconds;

    expect(later).toBeLessThanOrEqual(early);
  });
});

describe("FixedWindowRateLimiter memory bound", () => {
  const WINDOW = 1_000;
  const limiter = (maxKeys: number) => new FixedWindowRateLimiter({ maxRequests: 2, windowMs: WINDOW, maxKeys });

  it("drops the records of windows that have elapsed, so idle clients do not pile up", () => {
    const rateLimiter = limiter(100);

    for (let client = 0; client < 50; client += 1) rateLimiter.check(`client-${client}`, T0);
    expect(rateLimiter.size).toBe(50);

    rateLimiter.check("late-client", T0 + WINDOW + 1);

    expect(rateLimiter.size).toBe(1);
  });

  it("keeps the records of windows still open when it sweeps", () => {
    const rateLimiter = limiter(100);

    rateLimiter.check("early", T0);
    rateLimiter.check("recent", T0 + WINDOW - 1);
    rateLimiter.check("late", T0 + WINDOW + 1);

    expect(rateLimiter.size).toBe(2);
    expect(rateLimiter.check("recent", T0 + WINDOW + 2).allowed).toBe(true);
    expect(rateLimiter.check("recent", T0 + WINDOW + 3).allowed).toBe(false);
  });

  it("caps the number of tracked clients inside one window, evicting the oldest first", () => {
    const rateLimiter = limiter(3);

    for (let client = 0; client < 10; client += 1) rateLimiter.check(`client-${client}`, T0 + client);

    expect(rateLimiter.size).toBe(3);
    // The newest clients are still throttled; the evicted oldest one starts over.
    rateLimiter.check("client-9", T0 + 20);
    expect(rateLimiter.check("client-9", T0 + 21).allowed).toBe(false);
    expect(rateLimiter.check("client-0", T0 + 22).allowed).toBe(true);
  });

  it("still throttles a client that keeps hitting the endpoint while others come and go", () => {
    const rateLimiter = limiter(3);

    rateLimiter.check("noisy", T0);
    rateLimiter.check("noisy", T0 + 1);
    for (let client = 0; client < 2; client += 1) rateLimiter.check(`other-${client}`, T0 + 2 + client);

    expect(rateLimiter.check("noisy", T0 + 5).allowed).toBe(false);
  });

  it("has a default bound for the shared public limiter", async () => {
    const { publicRateLimiter, PUBLIC_RATE_LIMIT_MAX_TRACKED_CLIENTS } = await import("@/infrastructure/http/rate-limiter");

    for (let client = 0; client < PUBLIC_RATE_LIMIT_MAX_TRACKED_CLIENTS + 50; client += 1) {
      publicRateLimiter.check(`client-${client}`, T0);
    }

    expect(publicRateLimiter.size).toBe(PUBLIC_RATE_LIMIT_MAX_TRACKED_CLIENTS);
  });
});
