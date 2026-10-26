import { headers } from "next/headers";

import { deviceThrottleKey, verifyKnownDevice } from "@/infrastructure/auth/known-device";
import { readKnownDeviceToken } from "@/infrastructure/auth/known-device-cookies";
import { reportUnknownLoginClient } from "@/infrastructure/auth/login-rate-limiter";
import { clientKeyFromHeaders, UNKNOWN_CLIENT_KEY } from "@/infrastructure/http/client-ip";

/**
 * Best-effort per-client identifier for throttling. Uses the shared client IP
 * resolver so the login throttle and the public rate limiter trust the same
 * Vercel-set headers (`x-real-ip`, then the first `x-forwarded-for` entry).
 */
async function getClientKey(): Promise<string> {
  const key = clientKeyFromHeaders(await headers());

  if (key === UNKNOWN_CLIENT_KEY) {
    reportUnknownLoginClient();
  }

  return key;
}

export interface ThrottleTarget {
  /** The bucket this attempt is spent against, and cleared on success. */
  key: string;
  /** The known device presenting this attempt, if its cookie verified. */
  deviceId: string | undefined;
}

/**
 * A verified known-device cookie gets its own bucket (so a neighbour on the
 * admin's NAT who holds the IP bucket at the cap cannot lock the admin out);
 * anything else, including a forged or expired cookie, shares the IP bucket.
 * Shared by the password login and the Google callback: one throttle for every way in.
 */
export async function resolveThrottleTarget(): Promise<ThrottleTarget> {
  const token = await readKnownDeviceToken();
  const device = token ? await verifyKnownDevice(token) : undefined;

  if (device?.valid) {
    return { key: deviceThrottleKey(device.deviceId), deviceId: device.deviceId };
  }

  return { key: await getClientKey(), deviceId: undefined };
}
