import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  REGISTRATION_RATE_LIMIT_MAX_REQUESTS,
  REGISTRATION_RATE_LIMIT_WINDOW_MS,
  registrationRateLimiter,
} from "@/infrastructure/http/registration-rate-limiter";

describe("registration rate limiter", () => {
  it("is much stricter than the read limiter: a handful of attempts per client per window", () => {
    expect(REGISTRATION_RATE_LIMIT_MAX_REQUESTS).toBeLessThanOrEqual(10);
    expect(REGISTRATION_RATE_LIMIT_WINDOW_MS).toBeGreaterThanOrEqual(5 * 60 * 1000);
  });

  it("allows the budget, refuses the next attempt with a retry time, and counts clients apart", () => {
    const start = 1_000_000;

    for (let attempt = 0; attempt < REGISTRATION_RATE_LIMIT_MAX_REQUESTS; attempt += 1) {
      expect(registrationRateLimiter.check("client-a", start).allowed).toBe(true);
    }

    const refused = registrationRateLimiter.check("client-a", start + 1000);

    expect(refused.allowed).toBe(false);
    expect(refused.retryAfterSeconds).toBeGreaterThan(0);
    expect(registrationRateLimiter.check("client-b", start + 1000).allowed).toBe(true);
    expect(registrationRateLimiter.check("client-a", start + REGISTRATION_RATE_LIMIT_WINDOW_MS).allowed).toBe(true);
  });
});
