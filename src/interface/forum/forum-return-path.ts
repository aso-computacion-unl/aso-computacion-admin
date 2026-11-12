/** The forum's landing page: where a sign-in starts from and ends up when there is nothing to return to. */
export const FORUM_HOME_PATH = "/foro";

export const FORUM_RETURN_PATH_MAX_LENGTH = 512;

const FORUM_AUTH_PATH = "/foro/auth";
/** The event registration page lives outside the forum but signs in through it, so a sign-in may return there. */
const REGISTRATION_PATH = "/inscripciones";
// Never resolved against a real host: only here to let the URL parser do the dot-segment normalization.
const PROBE_ORIGIN = "https://forum.invalid";

// Whitespace and control characters (the parser would silently strip a tab or a newline), a backslash
// (some browsers read it as a slash), a doubled slash (a scheme-relative URL), and the percent-encodings
// of slash, backslash, percent and control characters (a second decoding somewhere must not find one).
const FORBIDDEN = /[\u0000-\u0020\u007f\\]|\/\/|%(?:2f|5c|25|[01][0-9a-f]|7f)/i;

/** Whether a value names the list of registrations (with or without a query) or a path below it. */
function isRegistrationPath(value: string): boolean {
  return value === REGISTRATION_PATH || value.startsWith(`${REGISTRATION_PATH}/`) || value.startsWith(`${REGISTRATION_PATH}?`);
}

/**
 * The same-origin path a sign-in may return to, normalized, or null for anything else (the caller falls back
 * to the forum landing; a bad value is never an error). Only `/foro` and `/foro/**` pass (never the forum's own
 * auth routes), `/inscripciones`, the list of registrations, and `/inscripciones/<slug>`, the event registration
 * page; so the value is safe to put in a redirect.
 */
export function parseForumReturnPath(value: string | null | undefined): string | null {
  if (!value || value.length > FORUM_RETURN_PATH_MAX_LENGTH || FORBIDDEN.test(value)) {
    return null;
  }

  if (value !== FORUM_HOME_PATH && !value.startsWith(`${FORUM_HOME_PATH}/`) && !isRegistrationPath(value)) {
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
  // The list itself (its header offers the sign-in, S1) or an event page, which needs a slug: the bare `/inscripciones/` is not a page.
  const inRegistration = pathname === REGISTRATION_PATH || (pathname.startsWith(`${REGISTRATION_PATH}/`) && pathname.length > REGISTRATION_PATH.length + 1);
  const lowered = pathname.toLowerCase();
  const inAuth = lowered === FORUM_AUTH_PATH || lowered.startsWith(`${FORUM_AUTH_PATH}/`);

  if (url.origin !== PROBE_ORIGIN || !(inForum || inRegistration) || inAuth || pathname.includes("//")) {
    return null;
  }

  return `${pathname}${url.search}`;
}

/** Whether a (validated) return path is a registration page, the list or an event's: a sign-in that began there must end there, even when it fails. */
export function isRegistrationReturnPath(path: string | null): path is string {
  return path !== null && isRegistrationPath(path);
}

/** Where to send a visitor so the sign-in brings them back to `returnTo` (an invalid or missing one is just the landing). */
export function forumSignInHref(returnTo?: string | null): string {
  const next = parseForumReturnPath(returnTo);

  return next ? `${FORUM_HOME_PATH}?next=${encodeURIComponent(next)}` : FORUM_HOME_PATH;
}
