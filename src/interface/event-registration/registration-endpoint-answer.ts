/*
 * What the three browser halves of a registration (the open form, the confirm and the cancel buttons) share about the
 * public endpoints they POST to: reading an answer without trusting its shape, and the wait of a `429`. No server-only
 * imports: the callers are client components.
 */

/** The `error` code of an answer's body, when it has one. */
export function errorCode(body: unknown): string | undefined {
  return body !== null && typeof body === "object" && "error" in body && typeof body.error === "string" ? body.error : undefined;
}

/** The `Retry-After` header as whole seconds, or null when it is missing or not a positive number. */
export function retryAfterSeconds(retryAfter: string | null): number | null {
  const seconds = Number(retryAfter);

  return retryAfter && Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : null;
}

/** How long to wait, in words: seconds under a minute, else whole minutes. */
export function waitText(seconds: number | null): string {
  if (seconds === null) return "unos minutos";
  if (seconds < 60) return `${seconds} ${seconds === 1 ? "segundo" : "segundos"}`;

  const minutes = Math.ceil(seconds / 60);

  return `${minutes} ${minutes === 1 ? "minuto" : "minutos"}`;
}

/**
 * POSTs `payload` as JSON to the event's registration endpoint, `/api/public/events/<slug>/registrations` plus `path`
 * (same origin: no CORS), and hands its answer to `read`. Never throws: a dead network is the `failed` outcome too.
 */
export async function postToRegistrationEndpoint<Outcome>(
  slug: string,
  path: "" | "/confirm" | "/cancel",
  payload: unknown,
  read: (status: number, body: unknown, retryAfter: string | null) => Outcome,
  failed: Outcome,
  send: typeof fetch,
): Promise<Outcome> {
  try {
    const response = await send(`/api/public/events/${encodeURIComponent(slug)}/registrations${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const body: unknown = await response.json().catch(() => null);

    return read(response.status, body, response.headers.get("Retry-After"));
  } catch {
    return failed;
  }
}
