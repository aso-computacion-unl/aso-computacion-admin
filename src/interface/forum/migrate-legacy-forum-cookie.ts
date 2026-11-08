import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import {
  FORUM_COOKIE_NAME,
  FORUM_COOKIE_PATH,
  FORUM_SESSION_DURATION_SECONDS,
  ForumSecretError,
  LEGACY_FORUM_COOKIE_NAME,
  LEGACY_FORUM_COOKIE_PATH,
  forumCookieOptions,
  verifyForumSession,
} from "@/infrastructure/forum/forum-session-jwt";

/**
 * The forum session used to live in `forum_session` on `/foro`; it now lives in `forum_sid` on `/`, so the event
 * registration page can see it. The first request that carries only the legacy cookie moves it: the token (a
 * signed JWT, valid as it is) is copied to the new cookie and the legacy one is expired, so nobody signs in again.
 * The current request is told about the new cookie too, so the page it renders already sees the session.
 *
 * A token that does not verify is expired but never copied. Without a usable forum secret nothing can be verified,
 * so nothing is touched: the legacy cookie waits for the secret to be fixed. Called by the proxy for `/foro/**`
 * and `/inscripciones/**`; the legacy cookie is only ever sent to `/foro` (its path).
 */
export async function migrateLegacyForumCookie(request: NextRequest): Promise<NextResponse> {
  const legacy = request.cookies.get(LEGACY_FORUM_COOKIE_NAME)?.value;

  if (legacy === undefined || request.cookies.has(FORUM_COOKIE_NAME)) {
    return NextResponse.next();
  }

  let valid: boolean;

  try {
    valid = (await verifyForumSession(legacy)).valid;
  } catch (error) {
    if (error instanceof ForumSecretError) {
      return NextResponse.next();
    }

    throw error;
  }

  let response: NextResponse;

  if (valid) {
    // The request's own cookie header, without the legacy cookie and with the new one.
    const kept = (request.headers.get("cookie") ?? "")
      .split(";")
      .map((pair) => pair.trim())
      .filter((pair) => pair !== "" && !pair.startsWith(`${LEGACY_FORUM_COOKIE_NAME}=`));
    const headers = new Headers(request.headers);

    headers.set("cookie", [...kept, `${FORUM_COOKIE_NAME}=${legacy}`].join("; "));
    response = NextResponse.next({ request: { headers } });
    response.cookies.set(FORUM_COOKIE_NAME, legacy, forumCookieOptions(FORUM_COOKIE_PATH, FORUM_SESSION_DURATION_SECONDS));
  } else {
    response = NextResponse.next();
  }

  response.cookies.set(LEGACY_FORUM_COOKIE_NAME, "", forumCookieOptions(LEGACY_FORUM_COOKIE_PATH, 0));

  return response;
}
