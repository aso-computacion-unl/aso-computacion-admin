/**
 * The parts of a Sentry event this module touches. Structural on purpose, so it needs no SDK import and
 * accepts an error event and a transaction alike.
 */
interface ScrubbableEvent {
  request?: { url?: string; query_string?: unknown; data?: unknown; cookies?: unknown; headers?: Record<string, string> };
  breadcrumbs?: { message?: string; data?: Record<string, unknown> }[];
  spans?: { description?: string; data?: Record<string, unknown> }[];
  exception?: { values?: { value?: string }[] };
}

const SENSITIVE_HEADERS = /^(authorization|proxy-authorization|cookie|set-cookie|x-api-key)$/i;
const URL_IN_TEXT = /\b[a-z][a-z0-9+.-]*:\/\/[^\s"'<>]+/gi;

/**
 * Keeps only the origin of every URL in a text. The landing deploy hook carries its secret token in the
 * path, and the SDK records outgoing requests (breadcrumbs, spans) with their full URL. Non-http schemes
 * (a database connection string in a Prisma error) have no origin, so they keep scheme and host only,
 * which drops the credentials.
 */
function redactUrls(text: string): string {
  return text.replace(URL_IN_TEXT, (match) => {
    try {
      const url = new URL(match);

      return url.origin !== "null" ? url.origin : `${url.protocol}//${url.hostname}`;
    } catch {
      return "[url]";
    }
  });
}

/** Origin and path only: no query string (an OAuth callback carries `code` and `state`) and no fragment. */
function redactRequestUrl(raw: string): string {
  try {
    const { origin, pathname } = new URL(raw);

    return origin !== "null" ? `${origin}${pathname}` : "[url]";
  } catch {
    return "[url]";
  }
}

function redactData(data: Record<string, unknown> | undefined): void {
  if (!data) {
    return;
  }

  for (const [key, value] of Object.entries(data)) {
    if (typeof value === "string") {
      data[key] = redactUrls(value);
    }
  }
}

/**
 * `beforeSend` / `beforeSendTransaction` for every runtime: removes what must not leave the server
 * (request bodies, cookies, credential headers, query strings) and the secret part of any URL. Mutates and returns the event.
 */
export function scrubSentryEvent<T extends ScrubbableEvent>(event: T): T {
  const { request } = event;

  if (request) {
    delete request.data;
    delete request.cookies;
    delete request.query_string;

    if (request.url) {
      request.url = redactRequestUrl(request.url);
    }

    if (request.headers) {
      request.headers = Object.fromEntries(Object.entries(request.headers).filter(([name]) => !SENSITIVE_HEADERS.test(name)));
    }
  }

  for (const breadcrumb of event.breadcrumbs ?? []) {
    if (breadcrumb.message) {
      breadcrumb.message = redactUrls(breadcrumb.message);
    }

    redactData(breadcrumb.data);
  }

  for (const span of event.spans ?? []) {
    if (span.description) {
      span.description = redactUrls(span.description);
    }

    redactData(span.data);
  }

  for (const exception of event.exception?.values ?? []) {
    if (exception.value) {
      exception.value = redactUrls(exception.value);
    }
  }

  return event;
}
