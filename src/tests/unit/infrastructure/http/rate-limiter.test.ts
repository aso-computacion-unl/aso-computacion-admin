import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  PUBLIC_RATE_LIMIT_MAX_REQUESTS,
  PUBLIC_RATE_LIMIT_WINDOW_MS,
  checkPublicRateLimit,
  resetPublicRateLimiter,
} from "@/infrastructure/http/rate-limiter";

afterEach(() => {
  resetPublicRateLimiter();
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
