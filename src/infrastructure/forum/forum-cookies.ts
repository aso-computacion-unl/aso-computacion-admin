import "server-only";
import { cookies } from "next/headers";

import { FORUM_OAUTH_STATE_COOKIE_NAME, FORUM_OAUTH_STATE_MAX_AGE_SECONDS } from "./forum-oauth-state";
import {
  FORUM_COOKIE_NAME,
  FORUM_COOKIE_PATH,
  FORUM_SESSION_DURATION_SECONDS,
  LEGACY_FORUM_COOKIE_NAME,
  LEGACY_FORUM_COOKIE_PATH,
  forumCookieOptions,
} from "./forum-session-jwt";

/** Only the forum's Google routes ever receive it. `lax`, because Google sends the browser back with a top-level GET. */
export const FORUM_OAUTH_COOKIE_PATH = "/foro/auth/google";

const secure = () => process.env.NODE_ENV === "production";

/**
 * Site-wide (`/`), so the registration page at `/inscripciones/<slug>` sees the session too. It is HttpOnly, has its
 * own name and secret, and the admin guard reads only the admin cookie, so being sent to `/admin` opens nothing.
 */
export async function setForumSessionCookie(token: string): Promise<void> {
  (await cookies()).set(FORUM_COOKIE_NAME, token, forumCookieOptions(FORUM_COOKIE_PATH, FORUM_SESSION_DURATION_SECONDS));
}

export async function readForumSessionCookie(): Promise<string | undefined> {
  return (await cookies()).get(FORUM_COOKIE_NAME)?.value;
}

/** Logout: expires the cookie and the legacy `/foro` one, so a browser that still has it cannot come back signed in. */
export async function clearForumSessionCookie(): Promise<void> {
  const jar = await cookies();

  jar.set(FORUM_COOKIE_NAME, "", forumCookieOptions(FORUM_COOKIE_PATH, 0));
  jar.set(LEGACY_FORUM_COOKIE_NAME, "", forumCookieOptions(LEGACY_FORUM_COOKIE_PATH, 0));
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
