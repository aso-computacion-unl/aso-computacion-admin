import { assertSlug } from "@/domain/slug";

/*
 * What the public routes under `/api/public/events/<slug>/` (the `.ics` file and the three registration endpoints)
 * share about reading a request before their own work starts.
 */

/** Whether the route's `<slug>` can name an event at all; anything else answers 404 without a database read. */
export function isEventSlug(value: string): boolean {
  try {
    assertSlug(value);

    return true;
  } catch {
    return false;
  }
}

/** The `error` code a registration endpoint answers when `readJsonObject` refused the body, with that status. */
export function bodyRefusal(status: 400 | 413 | 415): "too_large" | "unsupported_media_type" | "bad_request" {
  return status === 413 ? "too_large" : status === 415 ? "unsupported_media_type" : "bad_request";
}
