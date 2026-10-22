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
      vi.stubEnv("ADMIN_PASSWORD", "super-secret");

      const { getAdminPassword } = await import("@/infrastructure/auth/password");

      expect(getAdminPassword()).toBe("super-secret");
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
