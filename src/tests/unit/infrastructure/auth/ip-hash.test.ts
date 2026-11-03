import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { hashClientIp } from "@/infrastructure/auth/ip-hash";

describe("hashClientIp", () => {
  beforeEach(() => vi.stubEnv("ADMIN_SECRET", "a".repeat(32)));
  afterEach(() => vi.unstubAllEnvs());

  it("is a stable 32 character hex digest that does not contain the address", () => {
    const hash = hashClientIp("203.0.113.5");

    expect(hash).toMatch(/^[0-9a-f]{32}$/);
    expect(hashClientIp("203.0.113.5")).toBe(hash);
    expect(hash).not.toContain("203");
  });

  it("differs per address and per secret, so it cannot be recomputed without the secret", () => {
    const hash = hashClientIp("203.0.113.5");

    expect(hashClientIp("203.0.113.6")).not.toBe(hash);
    vi.stubEnv("ADMIN_SECRET", "b".repeat(32));
    expect(hashClientIp("203.0.113.5")).not.toBe(hash);
  });
});
