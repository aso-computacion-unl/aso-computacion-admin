import { createHmac } from "node:crypto";

import { SignJWT, decodeJwt } from "jose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  KNOWN_DEVICE_COOKIE_NAME,
  KNOWN_DEVICE_DURATION_SECONDS,
  deviceThrottleKey,
  newDeviceId,
  signKnownDevice,
  verifyKnownDevice,
} from "@/infrastructure/auth/known-device";
import { AUTH_COOKIE_NAME, signSession, verifySession } from "@/infrastructure/auth/session-jwt";

const SECRET = "z".repeat(32);
const PASSWORD_A = "correct horse battery staple";
const PASSWORD_B = "another long admin password";
const encode = (secret: string) => new TextEncoder().encode(secret);

async function currentPasswordVersion(): Promise<string> {
  return decodeJwt(await signKnownDevice("probe")).pv as string;
}

describe("known-device token", () => {
  beforeEach(() => {
    vi.stubEnv("ADMIN_SECRET", SECRET);
    vi.stubEnv("ADMIN_PASSWORD", PASSWORD_A);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("round-trips a device id", async () => {
    const id = newDeviceId();

    expect(await verifyKnownDevice(await signKnownDevice(id))).toEqual({ valid: true, deviceId: id });
  });

  it("uses its own cookie name and a long lifetime", () => {
    expect(KNOWN_DEVICE_COOKIE_NAME).not.toBe(AUTH_COOKIE_NAME);
    expect(KNOWN_DEVICE_DURATION_SECONDS).toBeGreaterThanOrEqual(30 * 86400);
  });

  it("makes unpredictable, distinct ids", () => {
    const ids = new Set(Array.from({ length: 50 }, newDeviceId));

    expect(ids.size).toBe(50);
    expect([...ids][0]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("maps a device id to a throttle key that cannot collide with a client IP", () => {
    expect(deviceThrottleKey("abc")).toBe("device:abc");
    expect(deviceThrottleKey("abc")).not.toMatch(/^[0-9.:a-f/]+$/);
  });

  it.each([
    ["an empty value", ""],
    ["garbage", "not-a-jwt"],
    ["a truncated token", "abc.def"],
  ])("rejects %s", async (_label, token) => {
    expect(await verifyKnownDevice(token)).toEqual({ valid: false });
  });

  it("rejects a token signed with another secret", async () => {
    const token = await new SignJWT({ purpose: "known-device", did: "d1" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("1h")
      .sign(encode("y".repeat(32)));

    expect(await verifyKnownDevice(token)).toEqual({ valid: false });
  });

  it("rejects an expired token", async () => {
    const now = Math.floor(Date.now() / 1000);

    expect(await verifyKnownDevice(await signKnownDevice("d1", now - KNOWN_DEVICE_DURATION_SECONDS - 60))).toEqual({
      valid: false,
    });
  });

  it("rejects an unsigned (alg none) token", async () => {
    const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
    const token = `${b64({ alg: "none", typ: "JWT" })}.${b64({ purpose: "known-device", did: "d1", exp: 4_000_000_000 })}.`;

    expect(await verifyKnownDevice(token)).toEqual({ valid: false });
  });

  it("rejects a token without the known-device purpose or without a device id", async () => {
    const pv = await currentPasswordVersion();
    const sign = (claims: Record<string, unknown>) =>
      new SignJWT(claims).setProtectedHeader({ alg: "HS256" }).setExpirationTime("1h").sign(encode(SECRET));

    expect(await verifyKnownDevice(await sign({ did: "d1", pv }))).toEqual({ valid: false });
    expect(await verifyKnownDevice(await sign({ purpose: "known-device", pv }))).toEqual({ valid: false });
    expect(await verifyKnownDevice(await sign({ purpose: "known-device", did: "", pv }))).toEqual({ valid: false });
    expect(await verifyKnownDevice(await sign({ purpose: "session", did: "d1", pv }))).toEqual({ valid: false });
    // Sanity: the same claims with the purpose and a device id are accepted, so the rejections above are about the missing parts.
    expect(await verifyKnownDevice(await sign({ purpose: "known-device", did: "d1", pv }))).toEqual({
      valid: true,
      deviceId: "d1",
    });
  });

  describe("password binding (pv claim)", () => {
    it("carries a truncated HMAC of the password keyed with ADMIN_SECRET, never the password itself", async () => {
      const claims = decodeJwt(await signKnownDevice("d1"));

      expect(claims.pv).toBe(createHmac("sha256", SECRET).update(PASSWORD_A).digest("hex").slice(0, 32));
      expect(JSON.stringify(claims)).not.toContain(PASSWORD_A);
    });

    it("ignores a cookie minted under password A once the password is rotated to B", async () => {
      const token = await signKnownDevice("d1");

      vi.stubEnv("ADMIN_PASSWORD", PASSWORD_B);

      expect(await verifyKnownDevice(token)).toEqual({ valid: false });
    });

    it("a cookie minted under B works under B, and the old one stays dead; rotating back revives the original", async () => {
      const underA = await signKnownDevice("d1");
      vi.stubEnv("ADMIN_PASSWORD", PASSWORD_B);
      const underB = await signKnownDevice("d1");

      expect(await verifyKnownDevice(underB)).toEqual({ valid: true, deviceId: "d1" });
      expect(await verifyKnownDevice(underA)).toEqual({ valid: false });

      vi.stubEnv("ADMIN_PASSWORD", PASSWORD_A);
      expect(await verifyKnownDevice(underA)).toEqual({ valid: true, deviceId: "d1" });
    });

    it("rejects a validly signed token with no pv or a wrong pv", async () => {
      const sign = (claims: Record<string, unknown>) =>
        new SignJWT({ purpose: "known-device", did: "d1", ...claims })
          .setProtectedHeader({ alg: "HS256" })
          .setExpirationTime("1h")
          .sign(encode(SECRET));

      expect(await verifyKnownDevice(await sign({}))).toEqual({ valid: false });
      expect(await verifyKnownDevice(await sign({ pv: "0".repeat(32) }))).toEqual({ valid: false });
      expect(await verifyKnownDevice(await sign({ pv: 42 }))).toEqual({ valid: false });
      expect(await verifyKnownDevice(await sign({ pv: (await currentPasswordVersion()).slice(0, 16) }))).toEqual({
        valid: false,
      });
    });

    it("treats an unusable ADMIN_PASSWORD as no device instead of throwing", async () => {
      const token = await signKnownDevice("d1");

      for (const password of ["", "__REPLACE_ADMIN_PASSWORD__", "short"]) {
        vi.stubEnv("ADMIN_PASSWORD", password);
        expect(await verifyKnownDevice(token)).toEqual({ valid: false });
      }
    });

    it("refuses to mint a device token while the password is unusable", async () => {
      vi.stubEnv("ADMIN_PASSWORD", "");

      await expect(signKnownDevice("d1")).rejects.toThrow();
    });
  });

  it("a session token is not a device token", async () => {
    expect(await verifyKnownDevice(await signSession())).toEqual({ valid: false });
  });

  it("a device token is never a session, even sent as the session cookie", async () => {
    const result = await verifySession(await signKnownDevice(newDeviceId()));

    expect(result.valid).toBe(false);
  });

  it("treats an unusable ADMIN_SECRET as no device instead of throwing", async () => {
    const token = await signKnownDevice("d1");
    vi.stubEnv("ADMIN_SECRET", "short");

    expect(await verifyKnownDevice(token)).toEqual({ valid: false });
  });
});
