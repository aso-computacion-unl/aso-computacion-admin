import "server-only";
import { cookies } from "next/headers";

import { FORUM_OAUTH_STATE_COOKIE_NAME, FORUM_OAUTH_STATE_MAX_AGE_SECONDS } from "./forum-oauth-state";
import { FORUM_COOKIE_NAME, FORUM_COOKIE_PATH, FORUM_SESSION_DURATION_SECONDS } from "./forum-session-jwt";

/** Only the forum's Google routes ever receive it. `lax`, because Google sends the browser back with a top-level GET. */
export const FORUM_OAUTH_COOKIE_PATH = "/foro/auth/google";

const secure = () => process.env.NODE_ENV === "production";

/**
 * Scoped to `/foro`: the browser never attaches it to `/admin`, so even a bug there could not read it.
 * (The admin cookie, path `/`, is sent to `/foro`, and the forum guard never looks at it.)
 */
export async function setForumSessionCookie(token: string): Promise<void> {
  (await cookies()).set(FORUM_COOKIE_NAME, token, {
    httpOnly: true,
    secure: secure(),
    sameSite: "lax",
    path: FORUM_COOKIE_PATH,
    maxAge: FORUM_SESSION_DURATION_SECONDS,
  });
}

export async function readForumSessionCookie(): Promise<string | undefined> {
  return (await cookies()).get(FORUM_COOKIE_NAME)?.value;
}

export async function clearForumSessionCookie(): Promise<void> {
  (await cookies()).set(FORUM_COOKIE_NAME, "", { httpOnly: true, secure: secure(), sameSite: "lax", path: FORUM_COOKIE_PATH, maxAge: 0 });
}

export async function setForumOAuthStateCookie(sealed: string): Promise<void> {
  (await cookies()).set(FORUM_OAUTH_STATE_COOKIE_NAME, sealed, {
    httpOnly: true,
    secure: secure(),
    sameSite: "lax",
    path: FORUM_OAUTH_COOKIE_PATH,
    maxAge: FORUM_OAUTH_STATE_MAX_AGE_SECONDS,
  });
}

export async function readForumOAuthStateCookie(): Promise<string | undefined> {
  return (await cookies()).get(FORUM_OAUTH_STATE_COOKIE_NAME)?.value;
}

export async function clearForumOAuthStateCookie(): Promise<void> {
  (await cookies()).delete({ name: FORUM_OAUTH_STATE_COOKIE_NAME, path: FORUM_OAUTH_COOKIE_PATH });
}
