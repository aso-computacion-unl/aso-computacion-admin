import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  LOGIN_ATTEMPT_WINDOW_MS,
  LOGIN_BACKOFF_CAP_MS,
  LOGIN_FREE_ATTEMPTS,
  consumeLoginAttempt,
  recordSuccessfulLogin,
} from "@/infrastructure/auth/login-rate-limiter";
import { prisma } from "@/infrastructure/prisma/client";

const T0 = 1_800_000_000_000;
const A = "203.0.113.7";
const B = "198.51.100.9";

async function spend(key: string, times: number, now: number) {
  const results = [];
  for (let i = 0; i < times; i += 1) results.push(await consumeLoginAttempt(key, now));
  return results;
}

describe("login rate limiter (Postgres)", () => {
  it("allows the free attempts, then asks for a growing wait instead of locking out", async () => {
    const free = await spend(A, LOGIN_FREE_ATTEMPTS, T0);

    expect(free.every((status) => status.allowed)).toBe(true);
    expect(await consumeLoginAttempt(A, T0)).toEqual({ allowed: false, retryAfterSeconds: 30 });

    // 30 s later one more attempt is allowed, and the next wait doubles.
    expect((await consumeLoginAttempt(A, T0 + 30_000)).allowed).toBe(true);
    expect(await consumeLoginAttempt(A, T0 + 30_000)).toEqual({ allowed: false, retryAfterSeconds: 60 });

    expect((await consumeLoginAttempt(A, T0 + 90_000)).allowed).toBe(true);
    expect(await consumeLoginAttempt(A, T0 + 90_000)).toEqual({ allowed: false, retryAfterSeconds: 120 });
  });

  it("caps the wait, so the delay never grows past a few minutes", async () => {
    let now = T0;
    // Wait out every delay and keep trying: far more attempts than it takes to reach the cap.
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const status = await consumeLoginAttempt(A, now);
      if (!status.allowed) now += status.retryAfterSeconds * 1000;
    }

    expect((await consumeLoginAttempt(A, now)).allowed).toBe(true);
    expect(await consumeLoginAttempt(A, now)).toEqual({ allowed: false, retryAfterSeconds: LOGIN_BACKOFF_CAP_MS / 1000 });
  });

  it("does not extend the wait for attempts made while waiting", async () => {
    await spend(A, LOGIN_FREE_ATTEMPTS, T0);

    // Hammering during the wait neither counts nor moves the unlock time.
    await spend(A, 25, T0 + 5_000);

    expect(await consumeLoginAttempt(A, T0 + 10_000)).toEqual({ allowed: false, retryAfterSeconds: 20 });
    expect((await consumeLoginAttempt(A, T0 + 30_000)).allowed).toBe(true);
    const row = await prisma.loginAttempt.findUnique({ where: { key: A } });
    expect(row?.attempts).toBe(LOGIN_FREE_ATTEMPTS + 1);
  });

  it("counts atomically: 25 parallel guesses from one IP spend exactly the free attempts", async () => {
    const statuses = await Promise.all(Array.from({ length: 25 }, () => consumeLoginAttempt(A, T0)));

    expect(statuses.filter((status) => status.allowed)).toHaveLength(LOGIN_FREE_ATTEMPTS);
    expect((await prisma.loginAttempt.findUnique({ where: { key: A } }))?.attempts).toBe(LOGIN_FREE_ATTEMPTS);
  });

  it("keeps IPs independent: another IP is not slowed by the first one's attempts (shared-network lockout)", async () => {
    await spend(A, 30, T0);

    expect(await consumeLoginAttempt(A, T0)).toMatchObject({ allowed: false });
    expect(await consumeLoginAttempt(B, T0)).toEqual({ allowed: true, retryAfterSeconds: 0 });
  });

  it("forgets old attempts once the window expires: the counter restarts and the backoff starts over", async () => {
    await spend(A, LOGIN_FREE_ATTEMPTS, T0);
    // Wait out the delay and fail again: the counter keeps growing inside the window.
    await consumeLoginAttempt(A, T0 + 30_000);
    expect((await prisma.loginAttempt.findUnique({ where: { key: A } }))?.attempts).toBe(LOGIN_FREE_ATTEMPTS + 1);

    const later = T0 + LOGIN_ATTEMPT_WINDOW_MS + 30_001;
    const fresh = await spend(A, LOGIN_FREE_ATTEMPTS, later);

    expect(fresh.every((status) => status.allowed)).toBe(true);
    expect((await prisma.loginAttempt.findUnique({ where: { key: A } }))?.attempts).toBe(LOGIN_FREE_ATTEMPTS);
    // Fresh backoff (30 s), not the 60 s the old counter would have asked for.
    expect(await consumeLoginAttempt(A, later)).toEqual({ allowed: false, retryAfterSeconds: 30 });
  });

  it("a successful login clears only that IP", async () => {
    await spend(A, LOGIN_FREE_ATTEMPTS, T0);
    await spend(B, LOGIN_FREE_ATTEMPTS, T0);

    await recordSuccessfulLogin(A);

    expect((await consumeLoginAttempt(A, T0)).allowed).toBe(true);
    expect((await consumeLoginAttempt(B, T0)).allowed).toBe(false);
  });

  it("purges rows older than the window so the table cannot grow without bound", async () => {
    await spend("192.0.2.1", 1, T0);
    await spend("192.0.2.2", 1, T0);

    await consumeLoginAttempt(A, T0 + LOGIN_ATTEMPT_WINDOW_MS + 1);

    expect(await prisma.loginAttempt.findMany({ select: { key: true } })).toEqual([{ key: A }]);
  });

  it("persists across instances: a fresh module copy sees the attempts of the first (no in-memory state)", async () => {
    await spend(A, LOGIN_FREE_ATTEMPTS, T0);
    vi.resetModules();
    const other = await import("@/infrastructure/auth/login-rate-limiter");

    expect(await other.consumeLoginAttempt(A, T0)).toEqual({ allowed: false, retryAfterSeconds: 30 });
  });
});
