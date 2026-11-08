import type { ForumActor } from "@/application";
import type { EventRegistrationStatus } from "@/application";
import type { OpenUnlEvent } from "@/application/event-registration/list-open-unl-events.use-case";
import { todayInEcuador } from "@/domain/calendar-date";
import { turnstileSecretWithoutSiteKey, turnstileSiteKey } from "@/infrastructure/http/turnstile";
import { getEventRegistrationServices } from "@/interface/public/event-registration-container";

import { getForumMember } from "./require-forum-member";

/** What the page says about the event, whatever way (if any) it takes registrations. */
export type EventFacts = EventRegistrationStatus["event"];

/**
 * What `/inscripciones/[slug]` shows, by the event's registration mode. `calendarHref` is the public `.ics` of the
 * event, or null when there is nothing to add (no exact day, or the day already passed).
 */
export type EventRegistrationPage =
  /** The signed-in member, or null: the page then offers the Google login. */
  | { kind: "unl"; member: ForumActor | null; status: EventRegistrationStatus }
  /**
   * The public form: no session needed. `siteKey` is the Turnstile widget's public key, if configured.
   * `captchaMisconfigured`: the secret is set without a site key, so the server demands a token the page cannot
   * produce; the page shows the event but no form.
   */
  | { kind: "open"; status: EventRegistrationStatus; siteKey: string | undefined; captchaMisconfigured: boolean; calendarHref: string | null }
  | { kind: "none"; event: EventFacts; calendarHref: string | null };

function calendarHrefFor(event: EventFacts, now: Date): string | null {
  const upcoming = event.date !== null && event.datePrecision === "day" && event.date >= todayInEcuador(now);

  return upcoming ? `/api/public/events/${event.slug}/calendar.ics` : null;
}

/** The page of one public event, or null (a 404) when it does not exist or is not public right now. */
export async function getEventRegistrationPage(slug: string, now: Date = new Date()): Promise<EventRegistrationPage | null> {
  const services = getEventRegistrationServices();
  const member = await getForumMember();
  const status = await services.status.execute({ slug, now, memberId: member?.memberId });

  if (status?.mode === "unl") {
    return { kind: "unl", member, status };
  }

  if (status) {
    return { kind: "open", status, siteKey: turnstileSiteKey(), captchaMisconfigured: turnstileSecretWithoutSiteKey(), calendarHref: calendarHrefFor(status.event, now) };
  }

  // No status: either the event is not public or it takes no registration. Only the second has a page.
  const event = await services.publicEvent.execute({ slug, now });

  if (event?.registrationMode !== "none") {
    return null;
  }

  const { slug: eventSlug, title, description, date, datePrecision, hora, lugar } = event;
  const facts: EventFacts = { slug: eventSlug, title, description, date, datePrecision, hora, lugar };

  return { kind: "none", event: facts, calendarHref: calendarHrefFor(facts, now) };
}

export type { OpenUnlEvent };

/**
 * The events the forum home offers to register for. The aside is a bonus on the thread list, so a failed
 * read leaves it out (and is logged) instead of taking the whole home down.
 */
export async function getOpenRegistrationEvents(now: Date = new Date()): Promise<OpenUnlEvent[]> {
  try {
    return await getEventRegistrationServices().openUnl.execute({ now });
  } catch (error) {
    console.error("Could not list the events open for registration", error);

    return [];
  }
}
