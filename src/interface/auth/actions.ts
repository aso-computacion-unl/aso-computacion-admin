"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  consumeLoginAttempt,
  recordSuccessfulLogin,
  reportUnknownLoginClient,
} from "@/infrastructure/auth/login-rate-limiter";
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

export async function login(prevState: LoginResult | null, formData: FormData): Promise<LoginResult> {
  // Fail closed and say why in the logs, before spending a throttle attempt on a login that cannot succeed.
  let adminPassword: string;

  try {
    adminPassword = getAdminPassword();
  } catch {
    reportAdminPasswordMisconfiguration();
    return { error: AUTH_SERVICE_UNAVAILABLE_ERROR };
  }

  const clientKey = await getClientKey();

  // The attempt is spent before the password is compared, so parallel guesses all count.
  let status: Awaited<ReturnType<typeof consumeLoginAttempt>>;

  try {
    status = await consumeLoginAttempt(clientKey);
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
    await recordSuccessfulLogin(clientKey);
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
  redirect("/admin");
}

export async function logout(): Promise<never> {
  await clearSessionCookie();
  redirect("/login");
}
