import type { EventResult } from "@/application";

import type { PublicEvent } from "./public-content.dto";
import { eventSchedule } from "./event-schedule";

type RegistrationFields = Pick<EventResult, "slug" | "date" | "datePrecision" | "hora" | "lugar"> & Partial<Pick<EventResult, "registrationMode" | "registrationCapacity" | "registrationDeadline">>;

/** The page where a UNL-account registration happens: on this admin, in the forum's zone. */
export function registrationPageUrl(slug: string, adminOrigin: string | undefined): string | null {
  return adminOrigin ? `${adminOrigin}/foro/eventos/${slug}` : null;
}

/** The public endpoint the landing's open form POSTs to. */
export function registrationEndpointUrl(slug: string, adminOrigin: string | undefined): string | null {
  return adminOrigin ? `${adminOrigin}/api/public/events/${slug}/registrations` : null;
}

export function calendarFileUrl(slug: string, adminOrigin: string | undefined): string | null {
  return adminOrigin ? `${adminOrigin}/api/public/events/${slug}/calendar.ics` : null;
}

/**
 * The additive keys of a public event (S8): how to register, where the calendar file is, and the values the
 * landing needs for a schema.org `Event`. URLs are null while the admin's public origin (`AUTH_URL`) is not configured.
 */
export function toPublicEventExtras(event: RegistrationFields, adminOrigin: string | undefined): Pick<PublicEvent, "registration" | "calendarUrl" | "structuredData"> {
  const mode = event.registrationMode ?? "none";
  const schedule = eventSchedule(event.date, event.datePrecision, event.hora);
  const url = mode === "unl" ? registrationPageUrl(event.slug, adminOrigin) : null;

  return {
    registration:
      mode === "none"
        ? null
        : {
            mode,
            capacity: event.registrationCapacity ?? null,
            deadline: event.registrationDeadline?.toISOString() ?? null,
            url,
            endpoint: mode === "open" ? registrationEndpointUrl(event.slug, adminOrigin) : null,
          },
    calendarUrl: schedule ? calendarFileUrl(event.slug, adminOrigin) : null,
    structuredData: schedule && { startDate: schedule.startLocal, endDate: schedule.endLocal, location: event.lugar, registrationUrl: url },
  };
}
