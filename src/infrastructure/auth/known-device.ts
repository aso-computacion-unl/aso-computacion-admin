import { SignJWT, jwtVerify } from "jose";

import { SESSION_ALGORITHM, getSessionSecret } from "./session-jwt";

/**
 * "Known device" token: a signed, long-lived marker the browser gets after a
 * successful login. A login attempt that carries a valid one is throttled in
 * its own bucket, keyed by the device id, instead of the shared IP bucket, so
 * somebody on the admin's own network (a campus NAT) who keeps the IP at the
 * backoff cap cannot keep the admin out. A forged, expired or missing token
 * simply falls back to the IP bucket.
 *
 * It is signed with the session secret but can never act as a session: it has
 * its own cookie name, no `sub: "admin"` claim (session verification requires
 * it) and a `purpose` claim that session tokens lack (device verification
 * requires it).
 */
export const KNOWN_DEVICE_COOKIE_NAME = "admin_device";
export const KNOWN_DEVICE_DURATION_SECONDS = 180 * 86400;

const KNOWN_DEVICE_PURPOSE = "known-device";

export type KnownDeviceResult = { valid: true; deviceId: string } | { valid: false };

export function newDeviceId(): string {
  return crypto.randomUUID();
}

/** Throttle bucket of one device. The prefix keeps it apart from every client IP key. */
export function deviceThrottleKey(deviceId: string): string {
  return `device:${deviceId}`;
}

export async function signKnownDevice(
  deviceId: string,
  issuedAtSeconds: number = Math.floor(Date.now() / 1000),
): Promise<string> {
  return new SignJWT({ purpose: KNOWN_DEVICE_PURPOSE, did: deviceId })
    .setProtectedHeader({ alg: SESSION_ALGORITHM })
    .setIssuedAt(issuedAtSeconds)
    .setExpirationTime(issuedAtSeconds + KNOWN_DEVICE_DURATION_SECONDS)
    .sign(getSessionSecret());
}

export async function verifyKnownDevice(token: string): Promise<KnownDeviceResult> {
  if (!token) {
    return { valid: false };
  }

  try {
    const { payload } = await jwtVerify(token, getSessionSecret(), {
      algorithms: [SESSION_ALGORITHM],
      clockTolerance: 5,
      requiredClaims: ["exp"],
    });

    if (payload.purpose !== KNOWN_DEVICE_PURPOSE || typeof payload.did !== "string" || payload.did.length === 0) {
      return { valid: false };
    }

    return { valid: true, deviceId: payload.did };
  } catch {
    // Forged, expired, malformed, or an unusable ADMIN_SECRET (the session path reports that one): no known device.
    return { valid: false };
  }
}
