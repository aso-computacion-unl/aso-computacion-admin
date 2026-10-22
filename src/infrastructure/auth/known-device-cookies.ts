import "server-only";
import { cookies } from "next/headers";

import { KNOWN_DEVICE_COOKIE_NAME, KNOWN_DEVICE_DURATION_SECONDS } from "./known-device";

/**
 * `secure` is unconditional (unlike the session cookie): the device cookie only
 * lowers a throttle, so a browser that refuses it over plain http (local
 * development) just falls back to the IP bucket.
 */
export function getKnownDeviceCookieOptions(): {
  httpOnly: true;
  secure: true;
  sameSite: "strict";
  path: "/";
  maxAge: number;
} {
  return {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: KNOWN_DEVICE_DURATION_SECONDS,
  };
}

export async function readKnownDeviceToken(): Promise<string | undefined> {
  const cookieStore = await cookies();

  return cookieStore.get(KNOWN_DEVICE_COOKIE_NAME)?.value;
}

export async function setKnownDeviceCookie(token: string): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.set(KNOWN_DEVICE_COOKIE_NAME, token, getKnownDeviceCookieOptions());
}
