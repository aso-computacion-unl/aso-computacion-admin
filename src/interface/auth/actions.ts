"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  consumeLoginAttempt,
  recordSuccessfulLogin,
  reportUnknownLoginClient,
} from "@/infrastructure/auth/login-rate-limiter";
import {
  deviceThrottleKey,
  newDeviceId,
  signKnownDevice,
  verifyKnownDevice,
} from "@/infrastructure/auth/known-device";
import { readKnownDeviceToken, setKnownDeviceCookie } from "@/infrastructure/auth/known-device-cookies";
import { comparePassword, getAdminPassword, reportAdminPasswordMisconfiguration } from "@/infrastructure/auth/password";
import { clientKeyFromHeaders, UNKNOWN_CLIENT_KEY } from "@/infrastructure/http/client-ip";
import { clearSessionCookie, setSessionCookie } from "@/infrastructure/auth/session-cookies";
import {
  reportSessionSecretMisconfiguration,
  SessionSecretError,
  signSession,
} from "@/infrastructure/auth/session-jwt";

export interface LoginResult {
  error?: string;
}

const INVALID_CREDENTIALS_ERROR = "Contraseña incorrecta.";
const AUTH_SERVICE_UNAVAILABLE_ERROR = "Authentication service is temporarily unavailable.";
const TOO_MANY_ATTEMPTS_ERROR = "Demasiados intentos. Intente de nuevo más tarde.";

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

interface ThrottleTarget {
  /** The bucket this attempt is spent against, and cleared on success. */
  key: string;
  /** The known device presenting this attempt, if its cookie verified. */
  deviceId: string | undefined;
}

/**
 * A verified known-device cookie gets its own bucket (so a neighbour on the
 * admin's NAT who holds the IP bucket at the cap cannot lock the admin out);
 * anything else, including a forged or expired cookie, shares the IP bucket.
 */
async function resolveThrottleTarget(): Promise<ThrottleTarget> {
  const token = await readKnownDeviceToken();
  const device = token ? await verifyKnownDevice(token) : undefined;

  if (device?.valid) {
    return { key: deviceThrottleKey(device.deviceId), deviceId: device.deviceId };
  }

  return { key: await getClientKey(), deviceId: undefined };
}

/** Best effort: the cookie only lowers a throttle, so failing to set it must never fail a correct login. */
async function rememberDevice(deviceId: string): Promise<void> {
  try {
    await setKnownDeviceCookie(await signKnownDevice(deviceId));
  } catch (error) {
    console.error("Could not set the known-device cookie after a successful login.", error);
  }
}

export async function login(prevState: LoginResult | null, formData: FormData): Promise<LoginResult> {
  // Fail closed and say why in the logs, before spending a throttle attempt on a login that cannot succeed.
  let adminPassword: string;

  try {
    adminPassword = getAdminPassword();
  } catch {
    reportAdminPasswordMisconfiguration();
    return { error: AUTH_SERVICE_UNAVAILABLE_ERROR };
  }

  const { key: throttleKey, deviceId } = await resolveThrottleTarget();

  // The attempt is spent before the password is compared, so parallel guesses all count.
  let status: Awaited<ReturnType<typeof consumeLoginAttempt>>;

  try {
    status = await consumeLoginAttempt(throttleKey);
  } catch (error) {
    // Without the throttle there is no brute-force protection: refuse rather than log in unprotected.
    console.error("Could not read the login throttle; login is unavailable.", error);
    return { error: AUTH_SERVICE_UNAVAILABLE_ERROR };
  }

  if (!status.allowed) {
    return { error: TOO_MANY_ATTEMPTS_ERROR };
  }

  const password = formData.get("password");

  if (typeof password !== "string" || password.length === 0) {
    return { error: INVALID_CREDENTIALS_ERROR };
  }

  if (!comparePassword(password, adminPassword)) {
    return { error: INVALID_CREDENTIALS_ERROR };
  }

  try {
    await recordSuccessfulLogin(throttleKey);
  } catch (error) {
    // The password was right; a leftover counter only costs a little head room, so do not turn it into a failed login.
    console.error("Could not clear the login throttle after a successful login.", error);
  }

  let token: string;

  try {
    token = await signSession();
  } catch (error) {
    if (error instanceof SessionSecretError) {
      reportSessionSecretMisconfiguration();
      return { error: AUTH_SERVICE_UNAVAILABLE_ERROR };
    }

    throw error;
  }

  await setSessionCookie(token);
  await rememberDevice(deviceId ?? newDeviceId());
  redirect("/admin");
}

export async function logout(): Promise<never> {
  await clearSessionCookie();
  redirect("/login");
}
