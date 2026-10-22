import { SignJWT } from "jose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
const encode = (secret: string) => new TextEncoder().encode(secret);

describe("known-device token", () => {
  beforeEach(() => {
    vi.stubEnv("ADMIN_SECRET", SECRET);
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
    const sign = (claims: Record<string, unknown>) =>
      new SignJWT(claims).setProtectedHeader({ alg: "HS256" }).setExpirationTime("1h").sign(encode(SECRET));

    expect(await verifyKnownDevice(await sign({ did: "d1" }))).toEqual({ valid: false });
    expect(await verifyKnownDevice(await sign({ purpose: "known-device" }))).toEqual({ valid: false });
    expect(await verifyKnownDevice(await sign({ purpose: "known-device", did: "" }))).toEqual({ valid: false });
    expect(await verifyKnownDevice(await sign({ purpose: "session", did: "d1" }))).toEqual({ valid: false });
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
