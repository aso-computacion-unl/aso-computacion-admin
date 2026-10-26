import { NextResponse } from "next/server";

import { googleConfig, type GoogleConfig } from "@/infrastructure/auth/auth-config";
import { completeGoogleAuthorization, GoogleAuthError, googleClient, startGoogleAuthorization } from "@/infrastructure/auth/google-oauth";
import { consumeLoginAttempt, recordSuccessfulLogin } from "@/infrastructure/auth/login-rate-limiter";
import { openOAuthState, sealOAuthState, statesMatch } from "@/infrastructure/auth/oauth-state";
import { clearOAuthStateCookie, readOAuthStateCookie, setOAuthStateCookie } from "@/infrastructure/auth/oauth-state-cookies";
import { reportError } from "@/infrastructure/observability/report-error";

import { recordAudit, SYSTEM_ACTOR } from "../audit/record-audit";
import { getAuthServices } from "./auth-container";
import { resolveThrottleTarget } from "./login-throttle";
import type { LoginErrorCode } from "./login-errors";
import { openSession } from "./session-lifecycle";

/** Where the browser goes: back to `/login` (with a code the page words), or into the admin. */
function redirectTo(base: URL | string, path: string, error?: LoginErrorCode): NextResponse {
  const url = new URL(path, base);

  if (error) {
    url.searchParams.set("error", error);
  }

  const response = NextResponse.redirect(url);
  response.headers.set("Cache-Control", "no-store");

  return response;
}

const loginFailure = (summary: string) => recordAudit(SYSTEM_ACTOR, { action: "login.failure", entityType: "session", summary });

/** Step 1: sends the browser to Google, remembering (in a sealed cookie) what the callback must find again. */
export async function startGoogleLogin(request: Request): Promise<NextResponse> {
  const config = googleConfig();

  if (!config) {
    return redirectTo(request.url, "/login");
  }

  try {
    const { url, ...flow } = startGoogleAuthorization(config);

    await setOAuthStateCookie(await sealOAuthState(flow));

    const response = NextResponse.redirect(url);
    response.headers.set("Cache-Control", "no-store");

    return response;
  } catch (error) {
    console.error("Could not start the Google login.");
    reportError(error, { action: "google-login-start" });

    return redirectTo(config.redirectUri, "/login", "unavailable");
  }
}

/**
 * Step 2: Google sends the browser back with `code` and `state`. The login throttle is spent first
 * (so garbage callbacks count), the flow cookie is consumed whatever happens (a callback URL cannot
 * be replayed), and every refusal of an account looks the same to the person: no way to learn which
 * emails exist. Nothing here logs or reports a code, a token or an email.
 */
export async function finishGoogleLogin(request: Request): Promise<NextResponse> {
  const config = googleConfig();

  if (!config) {
    return redirectTo(request.url, "/login");
  }

  const throttle = await resolveThrottleTarget();

  try {
    if (!(await consumeLoginAttempt(throttle.key)).allowed) {
      await clearOAuthStateCookie();
      return redirectTo(config.redirectUri, "/login", "throttled");
    }
  } catch (error) {
    // Without the throttle there is no brute-force protection: refuse rather than log in unprotected.
    console.error("Could not read the login throttle; login is unavailable.");
    reportError(error, { action: "login-throttle" });
    return redirectTo(config.redirectUri, "/login", "unavailable");
  }

  const params = new URL(request.url).searchParams;
  const flow = await openOAuthState(await readOAuthStateCookie());

  await clearOAuthStateCookie();

  const code = params.get("code");

  if (params.get("error") || !code || !flow || !statesMatch(params.get("state"), flow.state)) {
    await loginFailure("Acceso con Google interrumpido");
    return redirectTo(config.redirectUri, "/login", "failed");
  }

  return completeLogin(config, throttle.key, { code, codeVerifier: flow.codeVerifier, nonce: flow.nonce });
}

async function completeLogin(config: GoogleConfig, throttleKey: string, flow: { code: string; codeVerifier: string; nonce: string }): Promise<NextResponse> {
  let outcome: Awaited<ReturnType<ReturnType<typeof getAuthServices>["resolveGoogleLogin"]["execute"]>>;

  try {
    const identity = await completeGoogleAuthorization({ client: googleClient(config), clientId: config.clientId, ...flow });

    outcome = await getAuthServices().resolveGoogleLogin.execute(identity);
  } catch (error) {
    if (error instanceof GoogleAuthError) {
      console.error(`The Google sign-in was rejected (${error.failure}).`);
      reportError(error, { action: "google-login", failure: error.failure });
      await loginFailure("Acceso con Google rechazado: respuesta no válida");

      return redirectTo(config.redirectUri, "/login", "failed");
    }

    console.error("The Google sign-in failed unexpectedly.");
    reportError(error, { action: "google-login" });

    return redirectTo(config.redirectUri, "/login", "unavailable");
  }

  if (!outcome.ok) {
    await loginFailure("Acceso con Google rechazado");
    return redirectTo(config.redirectUri, "/login", "denied");
  }

  let sessionId: string;

  try {
    ({ sessionId } = await openSession({ kind: "user", userId: outcome.user.id }, outcome.user.role));
  } catch (error) {
    console.error("Could not open the session after the Google sign-in.");
    reportError(error, { action: "login-session" });

    return redirectTo(config.redirectUri, "/login", "unavailable");
  }

  try {
    await recordSuccessfulLogin(throttleKey);
  } catch {
    // The sign-in was right; a leftover counter only costs a little head room.
    console.error("Could not clear the login throttle after a successful login.");
  }

  await recordAudit(
    { kind: "user", userId: outcome.user.id },
    { action: "login.success", entityType: "session", entityId: sessionId, summary: "Inicio de sesión con Google" },
  );

  return redirectTo(config.redirectUri, "/admin");
}
