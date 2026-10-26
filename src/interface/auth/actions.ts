"use server";

import { redirect } from "next/navigation";

import { consumeLoginAttempt, recordSuccessfulLogin } from "@/infrastructure/auth/login-rate-limiter";
import { newDeviceId, signKnownDevice } from "@/infrastructure/auth/known-device";
import { setKnownDeviceCookie } from "@/infrastructure/auth/known-device-cookies";
import { comparePassword, getAdminPassword, reportAdminPasswordMisconfiguration } from "@/infrastructure/auth/password";
import { isBreakGlassEnabled } from "@/infrastructure/auth/auth-config";
import { reportError } from "@/infrastructure/observability/report-error";
import { reportSessionSecretMisconfiguration, SessionSecretError } from "@/infrastructure/auth/session-jwt";

import { recordAudit, SYSTEM_ACTOR } from "../audit/record-audit";
import { resolveThrottleTarget } from "./login-throttle";
import { closeSession, openSession } from "./session-lifecycle";

export interface LoginResult {
  error?: string;
  /** Set only when the typed password caused the error; service failures are not the field's fault. */
  field?: "password";
}

const INVALID_CREDENTIALS_ERROR = "Contraseña incorrecta.";
const AUTH_SERVICE_UNAVAILABLE_ERROR = "El acceso no está disponible en este momento. Intente de nuevo en unos minutos.";
const TOO_MANY_ATTEMPTS_ERROR = "Demasiados intentos. Intente de nuevo más tarde.";
const PASSWORD_LOGIN_DISABLED_ERROR = "El acceso con contraseña no está habilitado. Use el acceso con Google.";

/** Best effort: the cookie only lowers a throttle, so failing to set it must never fail a correct login. */
async function rememberDevice(deviceId: string): Promise<void> {
  try {
    await setKnownDeviceCookie(await signKnownDevice(deviceId));
  } catch (error) {
    console.error("Could not set the known-device cookie after a successful login.", error);
  }
}

/**
 * Break-glass: the shared-password emergency login. It exists only while `isBreakGlassEnabled()`
 * (Google not configured, or `BREAK_GLASS_PASSWORD_LOGIN=1`); it opens a session of the synthetic
 * ADMIN actor `break_glass`, which is listed in "Sesiones activas", can be revoked, and is audited.
 */
export async function login(prevState: LoginResult | null, formData: FormData): Promise<LoginResult> {
  if (!isBreakGlassEnabled()) {
    return { error: PASSWORD_LOGIN_DISABLED_ERROR };
  }

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
    reportError(error, { action: "login-throttle" });
    return { error: AUTH_SERVICE_UNAVAILABLE_ERROR };
  }

  if (!status.allowed) {
    return { error: TOO_MANY_ATTEMPTS_ERROR };
  }

  const password = formData.get("password");

  if (typeof password !== "string" || password.length === 0 || !comparePassword(password, adminPassword)) {
    await recordAudit(SYSTEM_ACTOR, { action: "login.failure", entityType: "session", summary: "Contraseña de emergencia rechazada" });
    return { error: INVALID_CREDENTIALS_ERROR, field: "password" };
  }

  try {
    await recordSuccessfulLogin(throttleKey);
  } catch (error) {
    // The password was right; a leftover counter only costs a little head room, so do not turn it into a failed login.
    console.error("Could not clear the login throttle after a successful login.", error);
  }

  let sessionId: string;

  try {
    ({ sessionId } = await openSession({ kind: "break_glass" }, "ADMIN"));
  } catch (error) {
    if (error instanceof SessionSecretError) {
      reportSessionSecretMisconfiguration();
    } else {
      console.error("Could not open the break-glass session; login is unavailable.");
      reportError(error, { action: "login-session" });
    }

    return { error: AUTH_SERVICE_UNAVAILABLE_ERROR };
  }

  await recordAudit(
    { kind: "break_glass", userId: null },
    { action: "login.success", entityType: "session", entityId: sessionId, summary: "Acceso de emergencia con contraseña" },
  );
  await rememberDevice(deviceId ?? newDeviceId());
  redirect("/admin");
}

export async function logout(): Promise<never> {
  await closeSession();
  redirect("/login");
}
