import { SYSTEM_ACTOR, recordAudit } from "../audit/record-audit";

/** How the person got to the button: the link of an email, or the event page (a signed-in UNL student). */
export type CancellationChannel = "email_link" | "unl_page";

const CHANNEL_LABELS: Record<CancellationChannel, string> = {
  email_link: "enlace del correo",
  unl_page: "página del evento",
};

/**
 * Records that a registration was cancelled by the person themselves (D7). The registration is already deleted, and with
 * it every datum that named the person, so the entry names the event only: no name, email, career, registration id or
 * token, like the admin's delete (`event.registration_delete`). The person is not an admin, so the actor is the system;
 * the summary says who decided. Written after the delete, as every audit entry is, and a failed write never undoes or
 * fails a cancellation the person already completed (`recordAudit` reports it and swallows it).
 */
export async function auditSelfCancellation(eventId: string, channel: CancellationChannel): Promise<void> {
  await recordAudit(SYSTEM_ACTOR, {
    action: "event.registration_cancel",
    entityType: "event",
    entityId: eventId,
    summary: `Inscripción cancelada por la persona (${CHANNEL_LABELS[channel]})`,
  });
}
