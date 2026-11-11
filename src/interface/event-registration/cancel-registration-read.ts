import type { EventRegistrationStatus } from "@/application";
import { getEventRegistrationServices } from "@/interface/public/event-registration-container";

/** What the page says about the event, whatever way (if any) it takes registrations. */
type EventFacts = EventRegistrationStatus["event"];

/**
 * What `/inscripciones/[slug]/cancelar` shows (D7). `registration` is the live state when the event still takes
 * registrations, null when it no longer does: the page then has no seats to show, but a person registered the old way
 * can still let theirs go, so the event itself is enough.
 */
export interface CancelRegistrationPage {
  event: EventFacts;
  mode: "unl" | "open" | "none";
  registration: EventRegistrationStatus | null;
}

/** The public event behind a cancellation link, or null (a 404, or "no longer available") when it does not exist or is not public right now. */
export async function getCancelRegistrationPage(slug: string, now: Date = new Date()): Promise<CancelRegistrationPage | null> {
  const services = getEventRegistrationServices();
  const status = await services.status.execute({ slug, now });

  if (status) {
    return { event: status.event, mode: status.mode, registration: status };
  }

  const event = await services.publicEvent.execute({ slug, now });

  if (!event) {
    return null;
  }

  const { slug: eventSlug, title, description, date, datePrecision, hora, lugar } = event;

  return { event: { slug: eventSlug, title, description, date, datePrecision, hora, lugar }, mode: "none", registration: null };
}
