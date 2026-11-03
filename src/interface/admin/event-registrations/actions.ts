"use server";

import { revalidatePath } from "next/cache";

import { getEventRegistrationServices } from "@/interface/public/event-registration-container";

import { recordAudit } from "../../audit/record-audit";
import { requireRole } from "../../auth/require-session";
import { mapActionError, type ActionResult } from "../action-result";

// Registrations are personal data: looking is editor-level (the page), deleting is ADMIN only. The guard is the
// first statement; the audit entry names the event only, never the person, and is written after the delete.

const registrationsPath = (eventId: string) => `/admin/events/${eventId}/registrations`;

export async function deleteEventRegistration(eventId: string, registrationId: string): Promise<ActionResult> {
  try {
    const actor = await requireRole("ADMIN");
    await getEventRegistrationServices().remove.execute({ eventId: String(eventId), registrationId: String(registrationId) });
    await recordAudit(actor, { action: "event.registration_delete", entityType: "event", entityId: eventId, summary: "Inscripción eliminada de un evento" });
    revalidatePath(registrationsPath(eventId));
    return { success: true };
  } catch (error) {
    return mapActionError(error);
  }
}
