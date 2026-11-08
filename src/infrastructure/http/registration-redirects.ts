/**
 * The event registration page used to live under the forum, at `/foro/eventos/<slug>`; it is now
 * `/inscripciones/<slug>`. Addresses already shared (the landing's tickets, calendar files, the public API of the
 * previous deploy) keep working through a permanent redirect (308). Next appends the request's query string to a
 * destination that has none, so `/foro/eventos/x?y=1` ends at `/inscripciones/x?y=1`.
 *
 * `/foro/eventos` itself (the member list) stays in the forum and is not redirected.
 */
export const REGISTRATION_REDIRECTS = [{ source: "/foro/eventos/:slug", destination: "/inscripciones/:slug", permanent: true }] as const;
