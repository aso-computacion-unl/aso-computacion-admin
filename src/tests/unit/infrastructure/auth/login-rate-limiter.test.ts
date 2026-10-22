import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  LOGIN_BACKOFF_BASE_MS,
  LOGIN_BACKOFF_CAP_MS,
  LOGIN_FREE_ATTEMPTS,
  loginDelayMs,
  reportUnknownLoginClient,
  resetUnknownLoginClientReport,
} from "@/infrastructure/auth/login-rate-limiter";

// The stateful rules (atomic increment, window expiry, per-IP independence) run
// against a real Postgres in
// src/tests/integration/infrastructure/login-rate-limiter.integration.test.ts.

describe("loginDelayMs (exponential backoff with a cap, never a hard lockout)", () => {
  it("is zero for the free attempts", () => {
    for (let attempts = 0; attempts < LOGIN_FREE_ATTEMPTS; attempts += 1) {
      expect(loginDelayMs(attempts)).toBe(0);
    }
  });

  it("starts at the base delay and doubles with every further attempt", () => {
    expect(LOGIN_FREE_ATTEMPTS).toBe(5);
    expect(LOGIN_BACKOFF_BASE_MS).toBe(30_000);
    expect([5, 6, 7, 8].map(loginDelayMs)).toEqual([30_000, 60_000, 120_000, 240_000]);
  });

  it("never exceeds the cap, however many attempts, so a hostile neighbour can delay the admin by minutes, not forever", () => {
    expect(LOGIN_BACKOFF_CAP_MS).toBe(5 * 60_000);
    expect(loginDelayMs(9)).toBe(LOGIN_BACKOFF_CAP_MS);
    expect(loginDelayMs(10_000)).toBe(LOGIN_BACKOFF_CAP_MS);
    expect(loginDelayMs(1_000_000)).toBe(LOGIN_BACKOFF_CAP_MS);
    expect(loginDelayMs(Number.MAX_SAFE_INTEGER)).toBe(LOGIN_BACKOFF_CAP_MS);
  });
});

describe("reportUnknownLoginClient", () => {
  beforeEach(() => resetUnknownLoginClientReport());
  afterEach(() => vi.restoreAllMocks());

  it("explains the shared bucket once per process, not once per login", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    reportUnknownLoginClient();
    reportUnknownLoginClient();

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toMatch(/no client ip/i);
    expect(warn.mock.calls[0]?.[0]).toMatch(/share/i);
  });
});
