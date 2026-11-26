"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requestSiteRebuild } from "@/infrastructure/deploy/deploy-hook";
import { getEventRegistrationServices } from "@/interface/public/event-registration-container";

import { recordAudit } from "../../audit/record-audit";
import { requireRole, requireSession } from "../../auth/require-session";
import { mapActionError, type ActionResult } from "../action-result";
import { getEventUseCases } from "../events/events-container";
import { isRegistrationChangeConfirmed, unconfirmedRegistrationChange } from "../events/registration-change-guard";
import { parseRegistrationFormData } from "../events/registration-form-fields";
import { savedRegistrationPath } from "./saved-flag";

// Registrations are personal data: looking is editor-level (the page), deleting is ADMIN only. The guard is the
// first statement; the audit entry names the event only, never the person, and is written after the delete.
// Setting up an event's registration is editing that event: any signed-in user, like `updateEvent`.

// Every event's registrants live on one screen (`?evento=<id>`); the old per-event URL only redirects there.
const REGISTRATIONS_PATH = "/admin/registrations";
const eventEditPath = (eventId: string) => `/admin/events/${eventId}/edit`;

/** The registration is on the landing's event card: a published event is rebuilt, a draft is not on the site. */
function refresh(eventId: string, isPublished: boolean) {
  if (isPublished) {
    requestSiteRebuild();
  }

  revalidatePath(REGISTRATIONS_PATH);
  revalidatePath(eventEditPath(eventId));
}

/** Turns on the registration of an upcoming event without one (S1), then shows it in the panel. */
export async function openEventRegistration(eventId: string, _prevState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  let id: string;

  try {
    const actor = await requireSession();
    id = String(eventId);
    const saved = await getEventUseCases().openRegistration.execute({ eventId: id, ...parseRegistrationFormData(formData) });
    await recordAudit(actor, { action: "event.registration_open", entityType: "event", entityId: id, summary: "Inscripción creada en un evento" });
    refresh(id, saved.isPublished);
  } catch (error) {
    return mapActionError(error);
  }

  redirect(savedRegistrationPath(id));
}

/** Changes or turns off the registration of an event; a change that affects registered people needs the confirmation (D14). */
export async function updateEventRegistration(eventId: string, _prevState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const actor = await requireSession();
    const id = String(eventId);
    const settings = parseRegistrationFormData(formData);
    const unconfirmed = await unconfirmedRegistrationChange(id, settings, isRegistrationChangeConfirmed(formData));

    if (unconfirmed) {
      return { error: unconfirmed };
    }

    const saved = await getEventUseCases().changeRegistration.execute({ eventId: id, ...settings });
    await recordAudit(actor, { action: "event.registration_update", entityType: "event", entityId: id, summary: "Inscripción de un evento editada" });
    refresh(id, saved.isPublished);
    return { success: true };
  } catch (error) {
    return mapActionError(error);
  }
}

export async function deleteEventRegistration(eventId: string, registrationId: string): Promise<ActionResult> {
  try {
    const actor = await requireRole("ADMIN");
    await getEventRegistrationServices().remove.execute({ eventId: String(eventId), registrationId: String(registrationId) });
    await recordAudit(actor, { action: "event.registration_delete", entityType: "event", entityId: eventId, summary: "Inscripción eliminada de un evento" });
    revalidatePath(REGISTRATIONS_PATH);
    return { success: true };
  } catch (error) {
    return mapActionError(error);
  }
}
