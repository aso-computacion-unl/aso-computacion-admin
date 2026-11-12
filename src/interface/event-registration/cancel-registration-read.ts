import type { EventRegistrationStatus } from "@/application";
import { cancellationRefusal } from "@/domain/event-registration";
import { getEventRegistrationServices } from "@/interface/public/event-registration-container";

/** What the page says about the event, whatever way (if any) it takes registrations. */
type EventFacts = EventRegistrationStatus["event"];

/**
 * What `/inscripciones/[slug]/cancelar` shows (D7). `registration` is the live state when the event still takes
 * registrations, null when it no longer does: the page then has no seats to show, but a person registered the old way
 * can still let theirs go, so the event itself is enough. `eventId` and `closed` let the page keep the button off where
 * the cancel endpoint would only refuse (S4): a link of another event, or an event whose registration closed.
 */
export interface CancelRegistrationPage {
  eventId: string;
  closed: boolean;
  event: EventFacts;
  mode: "unl" | "open" | "none";
  registration: EventRegistrationStatus | null;
}

/** The public event behind a cancellation link, or null (a 404, or "no longer available") when it does not exist or is not public right now. */
export async function getCancelRegistrationPage(slug: string, now: Date = new Date()): Promise<CancelRegistrationPage | null> {
  const services = getEventRegistrationServices();
  const [status, event] = await Promise.all([services.status.execute({ slug, now }), services.publicEvent.execute({ slug, now })]);

  if (!event) {
    return null;
  }

  // The same rule the cancellation itself applies, whatever the event's mode.
  const closed = cancellationRefusal({ event, now }) === "closed";

  if (status) {
    return { eventId: event.id, closed, event: status.event, mode: status.mode, registration: status };
  }

  const { slug: eventSlug, title, description, date, datePrecision, hora, lugar } = event;

  return { eventId: event.id, closed, event: { slug: eventSlug, title, description, date, datePrecision, hora, lugar }, mode: "none", registration: null };
}
