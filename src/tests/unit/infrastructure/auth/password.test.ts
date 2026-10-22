import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("password", () => {
  describe("comparePassword", () => {
    it("PASS-001: returns true for identical strings", async () => {
      const { comparePassword } = await import("@/infrastructure/auth/password");

      expect(comparePassword("abc", "abc")).toBe(true);
    });

    it("PASS-002: returns false for different strings", async () => {
      const { comparePassword } = await import("@/infrastructure/auth/password");

      expect(comparePassword("abc", "def")).toBe(false);
    });

    it("PASS-003: returns false for empty input without a length early return", async () => {
      const { comparePassword } = await import("@/infrastructure/auth/password");

      expect(comparePassword("", "abc")).toBe(false);
    });

    it("PASS-004: returns true for identical strings with accents", async () => {
      const { comparePassword } = await import("@/infrastructure/auth/password");

      expect(comparePassword("contraseña", "contraseña")).toBe(true);
    });

    it("PASS-005: returns true for identical unicode strings with emoji", async () => {
      const { comparePassword } = await import("@/infrastructure/auth/password");

      expect(comparePassword("pässwörd🔥", "pässwörd🔥")).toBe(true);
    });
  });

  describe("getAdminPassword", () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it("returns the ADMIN_PASSWORD env value when set", async () => {
      vi.stubEnv("ADMIN_PASSWORD", "super-secret-long-enough");

      const { getAdminPassword } = await import("@/infrastructure/auth/password");

      expect(getAdminPassword()).toBe("super-secret-long-enough");
    });

    it("throws AdminPasswordError when ADMIN_PASSWORD is missing or empty", async () => {
      vi.stubEnv("ADMIN_PASSWORD", "");

      const { getAdminPassword, AdminPasswordError } = await import("@/infrastructure/auth/password");

      expect(() => getAdminPassword()).toThrow(AdminPasswordError);
    });

    it("rejects the documented ADMIN_PASSWORD sentinel", async () => {
      vi.stubEnv("ADMIN_PASSWORD", "__REPLACE_ADMIN_PASSWORD__");

      const { getAdminPassword, AdminPasswordError } = await import("@/infrastructure/auth/password");

      expect(() => getAdminPassword()).toThrow(AdminPasswordError);
    });

    it("rejects a whitespace-wrapped ADMIN_PASSWORD sentinel", async () => {
      vi.stubEnv("ADMIN_PASSWORD", "  __REPLACE_ADMIN_PASSWORD__  ");

      const { getAdminPassword, AdminPasswordError } = await import("@/infrastructure/auth/password");

      expect(() => getAdminPassword()).toThrow(AdminPasswordError);
    });
  });
});

describe("getAdminPassword minimum length", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects a password shorter than 16 characters like a missing one", async () => {
    vi.stubEnv("ADMIN_PASSWORD", "fifteen-chars!!");

    const { getAdminPassword, AdminPasswordError } = await import("@/infrastructure/auth/password");

    expect("fifteen-chars!!").toHaveLength(15);
    expect(() => getAdminPassword()).toThrow(AdminPasswordError);
  });

  it("accepts exactly 16 characters", async () => {
    vi.stubEnv("ADMIN_PASSWORD", "sixteen-chars!!!");

    const { getAdminPassword } = await import("@/infrastructure/auth/password");

    expect(getAdminPassword()).toBe("sixteen-chars!!!");
  });

  it("counts characters, not bytes: 16 accented characters pass, 15 do not", async () => {
    const { getAdminPassword } = await import("@/infrastructure/auth/password");

    vi.stubEnv("ADMIN_PASSWORD", "ñ".repeat(16));
    expect(getAdminPassword()).toBe("ñ".repeat(16));

    vi.stubEnv("ADMIN_PASSWORD", "ñ".repeat(15));
    expect(() => getAdminPassword()).toThrow();
  });

  it("explains the length rule in the misconfiguration log", async () => {
    const { reportAdminPasswordMisconfiguration } = await import("@/infrastructure/auth/password");
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);

    reportAdminPasswordMisconfiguration();

    expect(log.mock.calls[0]?.[0]).toMatch(/ADMIN_PASSWORD/);
    expect(log.mock.calls[0]?.[0]).toMatch(/16/);
    log.mockRestore();
  });
});
