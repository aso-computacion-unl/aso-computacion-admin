import { NextResponse } from "next/server";

import { forumGoogleConfig } from "@/infrastructure/forum/forum-config";
import { clearForumOAuthStateCookie, readForumOAuthStateCookie, setForumOAuthStateCookie } from "@/infrastructure/forum/forum-cookies";
import { openForumOAuthState, sealForumOAuthState } from "@/infrastructure/forum/forum-oauth-state";
import { completeGoogleAuthorization, GoogleAuthError, googleClient, startGoogleAuthorization } from "@/infrastructure/auth/google-oauth";
import { statesMatch } from "@/infrastructure/auth/oauth-state";
import { reportError } from "@/infrastructure/observability/report-error";

import { getForumServices } from "./forum-container";
import type { ForumLoginErrorCode } from "./forum-login-errors";
import { FORUM_HOME_PATH } from "./forum-return-path";
import { openForumSession } from "./forum-session-lifecycle";

function redirectTo(base: URL | string, error?: ForumLoginErrorCode): NextResponse {
  const url = new URL(FORUM_HOME_PATH, base);

  if (error) {
    url.searchParams.set("error", error);
  }

  const response = NextResponse.redirect(url);
  response.headers.set("Cache-Control", "no-store");

  return response;
}

/** Step 1: sends the browser to Google, remembering (in a sealed cookie) what the callback must find again. */
export async function startForumLogin(request: Request): Promise<NextResponse> {
  const config = forumGoogleConfig();

  // Fail closed: without the domain, the forum secret and a Google client nobody signs in.
  if (!config) {
    return redirectTo(request.url, "unavailable");
  }

  try {
    const { url, ...flow } = startGoogleAuthorization(config);

    await setForumOAuthStateCookie(await sealForumOAuthState(flow));

    const response = NextResponse.redirect(url);
    response.headers.set("Cache-Control", "no-store");

    return response;
  } catch (error) {
    console.error("Could not start the forum Google login.");
    reportError(error, { action: "forum-login-start" });

    return redirectTo(config.redirectUri, "unavailable");
  }
}

/**
 * Step 2: Google sends the browser back with `code` and `state`. The flow cookie is consumed whatever
 * happens (a callback URL cannot be replayed), and every refusal of an account looks the same to the
 * person. Nothing here logs or reports a code, a token or an email.
 */
export async function finishForumLogin(request: Request): Promise<NextResponse> {
  const config = forumGoogleConfig();

  if (!config) {
    return redirectTo(request.url, "unavailable");
  }

  const params = new URL(request.url).searchParams;
  const flow = await openForumOAuthState(await readForumOAuthStateCookie());

  await clearForumOAuthStateCookie();

  const code = params.get("code");

  if (params.get("error") || !code || !flow || !statesMatch(params.get("state"), flow.state)) {
    return redirectTo(config.redirectUri, "failed");
  }

  try {
    const identity = await completeGoogleAuthorization({ client: googleClient(config), clientId: config.clientId, code, codeVerifier: flow.codeVerifier, nonce: flow.nonce });
    const outcome = await getForumServices().resolveLogin.execute(identity);

    if (!outcome.ok) {
      console.error(`The forum sign-in was refused (${outcome.reason}).`);

      return redirectTo(config.redirectUri, "denied");
    }

    await openForumSession(outcome.member.id);

    return redirectTo(config.redirectUri);
  } catch (error) {
    if (error instanceof GoogleAuthError && error.failure === "unavailable") {
      // Google or the network to it is down: not a verdict on the person, so retryable.
      console.error("The forum Google sign-in could not be verified (Google unavailable).");
      reportError(error, { action: "forum-login", failure: error.failure });

      return redirectTo(config.redirectUri, "verification");
    }

    if (error instanceof GoogleAuthError) {
      console.error(`The forum Google sign-in was rejected (${error.failure}).`);
      reportError(error, { action: "forum-login", failure: error.failure });

      return redirectTo(config.redirectUri, "failed");
    }

    console.error("The forum Google sign-in failed unexpectedly.");
    reportError(error, { action: "forum-login" });

    return redirectTo(config.redirectUri, "unavailable");
  }
}
