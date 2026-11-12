import type { ReminderMessageBuilder } from "@/application/event-registration/send-registration-reminders.use-case";
import { registrationConfirmSecret } from "@/infrastructure/mail/mail-config";
import { sealRegistrationCancelToken } from "@/infrastructure/registration/registration-cancel-token";

import { reminderEmail } from "./registration-emails";

/**
 * The reminder of one person (R6): the event page, the calendar file and (D7) the link that cancels THAT person's
 * registration, signed for them. A reminder with a missing or unusable signing secret still goes out, saying there is
 * nothing to do: the people already registered are not left without their reminder over a link that cannot be signed.
 */
export function buildReminderMessage(origin: string): ReminderMessageBuilder {
  return async (event, person) => {
    const cancelToken = registrationConfirmSecret() ? await sealRegistrationCancelToken({ registrationId: person.id, eventId: event.id }) : null;

    return reminderEmail({
      event,
      eventUrl: `${origin}/inscripciones/${event.slug}`,
      calendarUrl: `${origin}/api/public/events/${event.slug}/calendar.ics`,
      cancelUrl: cancelToken ? `${origin}/inscripciones/${event.slug}/cancelar?token=${cancelToken}` : null,
    });
  };
}
