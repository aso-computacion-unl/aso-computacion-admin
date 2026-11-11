import type { ForumActor, OwnForumAccount } from "@/application";
import type { EventRegistrationStatus } from "@/application";
import type { OpenRegistrationEvent } from "@/application/event-registration/list-open-registration-events.use-case";
import { todayInEcuador } from "@/domain/calendar-date";
import { publicOrigin } from "@/infrastructure/auth/auth-config";
import { isForumEnabled } from "@/infrastructure/forum/forum-config";
import { turnstileSecretWithoutSiteKey, turnstileSiteKey } from "@/infrastructure/http/turnstile";
import { gmailConfig } from "@/infrastructure/mail/mail-config";
import { getEventRegistrationServices } from "@/interface/public/event-registration-container";

import { getForumServices } from "./forum-container";
import { getForumMember } from "./require-forum-member";

/** What the page says about the event, whatever way (if any) it takes registrations. */
export type EventFacts = EventRegistrationStatus["event"];

/**
 * What `/inscripciones/[slug]` shows, by the event's registration mode. `calendarHref` is the public `.ics` of the
 * event, or null when there is nothing to add (no exact day, or the day already passed).
 */
export type EventRegistrationPage =
  /**
   * The signed-in member, or null: the page then offers the Google login, unless `loginAvailable` is false (the login
   * is not configured on this server): then it says the UNL registration is not available right now (S8).
   */
  | { kind: "unl"; member: ForumActor | null; loginAvailable: boolean; status: EventRegistrationStatus; calendarHref: string | null; remindersOn: boolean }
  /**
   * The public form: no session needed. `siteKey` is the Turnstile widget's public key, if configured.
   * `captchaMisconfigured`: the secret is set without a site key, so the server demands a token the page cannot
   * produce; the page shows the event but no form.
   */
  | { kind: "open"; status: EventRegistrationStatus; siteKey: string | undefined; captchaMisconfigured: boolean; calendarHref: string | null }
  | { kind: "none"; event: EventFacts; calendarHref: string | null };

/** Whether a registered person will get a reminder: the mail is set up and there is an address to link to. The page promises it only then. */
function remindersAreOn(): boolean {
  return gmailConfig() !== null && publicOrigin(process.env.AUTH_URL) !== undefined;
}

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
    return { kind: "unl", member, loginAvailable: isForumEnabled(), status, calendarHref: calendarHrefFor(status.event, now), remindersOn: remindersAreOn() };
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

export type { OpenRegistrationEvent };

/**
 * The events the public `/inscripciones` list shows: every one that takes a registration right now, UNL or open form.
 * A failed read is not hidden: the page is the list, and an empty one would say that nothing is open.
 */
export async function getOpenRegistrationEvents(now: Date = new Date()): Promise<OpenRegistrationEvent[]> {
  return getEventRegistrationServices().openRegistrations.execute({ now });
}

/** What the header of the registrations offers this browser (S1, S2): the signed-in member's own account, or the sign-in when it can work. */
export interface RegistrationAccess {
  member: OwnForumAccount | null;
  /** The forum's Google sign-in is configured on this server; without it the header offers none. */
  loginAvailable: boolean;
}

export async function getRegistrationAccess(): Promise<RegistrationAccess> {
  const actor = await getForumMember();
  const member = actor ? await getForumServices().ownAccount.execute({ memberId: actor.memberId }) : null;

  return { member, loginAvailable: isForumEnabled() };
}
