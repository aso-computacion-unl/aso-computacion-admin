"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  checkLoginRate,
  recordFailedLogin,
  recordSuccessfulLogin,
} from "@/infrastructure/auth/login-rate-limiter";
import { comparePassword, getAdminPassword } from "@/infrastructure/auth/password";
import { clientKeyFromHeaders } from "@/infrastructure/http/client-ip";
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
  return clientKeyFromHeaders(await headers());
}

export async function login(prevState: LoginResult | null, formData: FormData): Promise<LoginResult> {
  const clientKey = await getClientKey();

  if (!checkLoginRate(clientKey).allowed) {
    return { error: TOO_MANY_ATTEMPTS_ERROR };
  }

  const password = formData.get("password");

  if (typeof password !== "string" || password.length === 0) {
    recordFailedLogin(clientKey);
    return { error: INVALID_CREDENTIALS_ERROR };
  }

  let adminPassword: string;

  try {
    adminPassword = getAdminPassword();
  } catch {
    return { error: INVALID_CREDENTIALS_ERROR };
  }

  if (!comparePassword(password, adminPassword)) {
    recordFailedLogin(clientKey);
    return { error: INVALID_CREDENTIALS_ERROR };
  }

  recordSuccessfulLogin(clientKey);

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
