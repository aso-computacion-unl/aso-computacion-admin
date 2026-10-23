import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  LOGIN_LOCKOUT_MS,
  LOGIN_MAX_FAILED_ATTEMPTS,
  checkLoginRate,
  recordFailedLogin,
  recordSuccessfulLogin,
  resetLoginRateLimiter,
} from "@/infrastructure/auth/login-rate-limiter";

afterEach(() => {
  resetLoginRateLimiter();
});

const KEY = "203.0.113.7";
const T0 = 1_000_000;

describe("login rate limiter", () => {
  it("allows an untracked key", () => {
    expect(checkLoginRate(KEY, T0)).toEqual({ allowed: true, retryAfterSeconds: 0 });
  });

  it("keeps allowing while below the failure threshold", () => {
    for (let i = 0; i < LOGIN_MAX_FAILED_ATTEMPTS - 1; i += 1) {
      recordFailedLogin(KEY, T0);
    }

    expect(checkLoginRate(KEY, T0).allowed).toBe(true);
  });

  it("locks the key after the threshold is reached", () => {
    for (let i = 0; i < LOGIN_MAX_FAILED_ATTEMPTS; i += 1) {
      recordFailedLogin(KEY, T0);
    }

    const status = checkLoginRate(KEY, T0);
    expect(status.allowed).toBe(false);
    expect(status.retryAfterSeconds).toBe(LOGIN_LOCKOUT_MS / 1000);
  });

  it("reports a shrinking retry-after as time passes", () => {
    for (let i = 0; i < LOGIN_MAX_FAILED_ATTEMPTS; i += 1) {
      recordFailedLogin(KEY, T0);
    }

    const halfway = T0 + LOGIN_LOCKOUT_MS / 2;
    expect(checkLoginRate(KEY, halfway).retryAfterSeconds).toBe(LOGIN_LOCKOUT_MS / 2 / 1000);
  });

  it("allows again once the lockout window elapses", () => {
    for (let i = 0; i < LOGIN_MAX_FAILED_ATTEMPTS; i += 1) {
      recordFailedLogin(KEY, T0);
    }

    expect(checkLoginRate(KEY, T0 + LOGIN_LOCKOUT_MS + 1).allowed).toBe(true);
  });

  it("does not extend the lockout for attempts made while already locked", () => {
    for (let i = 0; i < LOGIN_MAX_FAILED_ATTEMPTS; i += 1) {
      recordFailedLogin(KEY, T0);
    }

    // Hammering during the lockout must not push the unlock time further out.
    recordFailedLogin(KEY, T0 + 1000);

    expect(checkLoginRate(KEY, T0 + LOGIN_LOCKOUT_MS + 1).allowed).toBe(true);
  });

  it("resets the counter on a successful login", () => {
    for (let i = 0; i < LOGIN_MAX_FAILED_ATTEMPTS - 1; i += 1) {
      recordFailedLogin(KEY, T0);
    }
    recordSuccessfulLogin(KEY);

    // After a success, one more failure must not trip the (previously near) threshold.
    recordFailedLogin(KEY, T0);
    expect(checkLoginRate(KEY, T0).allowed).toBe(true);
  });

  it("tracks keys independently", () => {
    for (let i = 0; i < LOGIN_MAX_FAILED_ATTEMPTS; i += 1) {
      recordFailedLogin(KEY, T0);
    }

    expect(checkLoginRate("198.51.100.9", T0).allowed).toBe(true);
  });
});
