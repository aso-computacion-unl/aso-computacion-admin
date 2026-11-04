/** The forum's landing page: where a sign-in starts from and ends up when there is nothing to return to. */
export const FORUM_HOME_PATH = "/foro";

export const FORUM_RETURN_PATH_MAX_LENGTH = 512;

const FORUM_AUTH_PATH = "/foro/auth";
// Never resolved against a real host: only here to let the URL parser do the dot-segment normalization.
const PROBE_ORIGIN = "https://forum.invalid";

// Whitespace and control characters (the parser would silently strip a tab or a newline), a backslash
// (some browsers read it as a slash), a doubled slash (a scheme-relative URL), and the percent-encodings
// of slash, backslash, percent and control characters (a second decoding somewhere must not find one).
const FORBIDDEN = /[\u0000-\u0020\u007f\\]|\/\/|%(?:2f|5c|25|[01][0-9a-f]|7f)/i;

/**
 * The same-origin forum path a sign-in may return to, normalized, or null for anything else (the caller
 * falls back to the forum landing; a bad value is never an error). Only `/foro` and `/foro/**` pass, never
 * the forum's own auth routes, so the value is safe to put in a redirect.
 */
export function parseForumReturnPath(value: string | null | undefined): string | null {
  if (!value || value.length > FORUM_RETURN_PATH_MAX_LENGTH || FORBIDDEN.test(value)) {
    return null;
  }

  if (value !== FORUM_HOME_PATH && !value.startsWith(`${FORUM_HOME_PATH}/`)) {
    return null;
  }

  let url: URL;

  try {
    url = new URL(value, PROBE_ORIGIN);
  } catch {
    return null;
  }

  const { pathname } = url;
  const inForum = pathname === FORUM_HOME_PATH || pathname.startsWith(`${FORUM_HOME_PATH}/`);
  const lowered = pathname.toLowerCase();
  const inAuth = lowered === FORUM_AUTH_PATH || lowered.startsWith(`${FORUM_AUTH_PATH}/`);

  if (url.origin !== PROBE_ORIGIN || !inForum || inAuth || pathname.includes("//")) {
    return null;
  }

  return `${pathname}${url.search}`;
}

/** Where to send a visitor so the sign-in brings them back to `returnTo` (an invalid or missing one is just the landing). */
export function forumSignInHref(returnTo?: string | null): string {
  const next = parseForumReturnPath(returnTo);

  return next ? `${FORUM_HOME_PATH}?next=${encodeURIComponent(next)}` : FORUM_HOME_PATH;
}
