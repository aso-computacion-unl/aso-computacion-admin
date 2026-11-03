import "server-only";
import { cookies } from "next/headers";

import { OAUTH_STATE_COOKIE_NAME, OAUTH_STATE_MAX_AGE_SECONDS } from "./oauth-state";

/** Only the Google routes ever receive it. `lax`, because Google sends the browser back with a top-level GET. */
const COOKIE_PATH = "/auth/google";

export async function setOAuthStateCookie(sealed: string): Promise<void> {
  (await cookies()).set(OAUTH_STATE_COOKIE_NAME, sealed, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: COOKIE_PATH,
    maxAge: OAUTH_STATE_MAX_AGE_SECONDS,
  });
}

export async function readOAuthStateCookie(): Promise<string | undefined> {
  return (await cookies()).get(OAUTH_STATE_COOKIE_NAME)?.value;
}

export async function clearOAuthStateCookie(): Promise<void> {
  (await cookies()).delete({ name: OAUTH_STATE_COOKIE_NAME, path: COOKIE_PATH });
}
