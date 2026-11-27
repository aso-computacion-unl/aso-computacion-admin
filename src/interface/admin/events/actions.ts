"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { CreateEventCommand } from "@/application/use-cases/create-event.use-case";
import type { Actor } from "@/domain/user";
import { requestSiteRebuild } from "@/infrastructure/deploy/deploy-hook";
import { assertValidImageSignature, imageUploadSchema } from "@/interface/validation/image-upload.schema";

import { recordAudit } from "../../audit/record-audit";
import { requireSession } from "../../auth/require-session";
import { mapActionError, type ActionResult } from "../action-result";
import { REGISTRATIONS_PATH, savedRegistrationPath } from "../event-registrations/saved-flag";
import { shouldRebuildSite } from "../site-rebuild-policy";
import { TRASH_PATH } from "../trash/paths";
import { createdEventPath } from "./created-flag";
import { parseCreateEventFormData, parseEventFormData } from "./event-form-data";
import { getEventUseCases } from "./events-container";

// Every action starts with the session guard, before it reads any input or touches a use case (a
// server action can be POSTed to any page). Events are editor-level content: any signed-in user.
// The audit entry is written after the mutation succeeded and can never fail the action.

const LIST_PATH = "/admin/events";
const editPath = (eventId: string) => `${LIST_PATH}/${eventId}/edit`;

/**
 * Creates the event and audits it. An event with registration also records its registration, after the creation
 * entry. `parseCreateEventFormData` sets `registrationMode` only for «Evento con inscripción» (always unl or open),
 * so its presence is what marks one.
 */
async function createAudited(actor: Actor, command: CreateEventCommand) {
  const created = await getEventUseCases().create.execute(command);
  await recordAudit(actor, { action: "event.create", entityType: "event", entityId: created.id, summary: "Evento creado" });

  if (command.registrationMode !== undefined) {
    await recordAudit(actor, { action: "event.registration_open", entityType: "event", entityId: created.id, summary: "Inscripción creada en un evento" });
  }

  return created;
}

export async function createEvent(_prevState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  let id: string;
  let isPublished: boolean;

  try {
    const actor = await requireSession();
    ({ id, isPublished } = await createAudited(actor, parseCreateEventFormData(formData)));
  } catch (error) {
    return mapActionError(error);
  }

  // A new draft is not on the site yet.
  if (shouldRebuildSite(false, isPublished)) {
    requestSiteRebuild();
  }

  revalidatePath(LIST_PATH);
  // Photos need an existing event, so creating continues on its edit page, aimed at the Photos section.
  redirect(createdEventPath(editPath(id)));
}

/**
 * «Crear inscripción» in Inscripciones (event-kinds S3, S4): always a new event with registration, whatever kind the
 * post names. It lands on the registrations panel with that event selected and the saved notice.
 */
export async function createEventWithRegistration(_prevState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  let id: string;
  let isPublished: boolean;

  try {
    const actor = await requireSession();
    ({ id, isPublished } = await createAudited(actor, parseCreateEventFormData(formData, true)));
  } catch (error) {
    return mapActionError(error);
  }

  if (shouldRebuildSite(false, isPublished)) {
    requestSiteRebuild();
  }

  revalidatePath(LIST_PATH);
  revalidatePath(REGISTRATIONS_PATH);
  redirect(savedRegistrationPath(id));
}

export async function updateEvent(
  id: string,
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const actor = await requireSession();
    const saved = await getEventUseCases().update.execute({ id, ...parseEventFormData(formData) });
    await recordAudit(actor, { action: "event.update", entityType: "event", entityId: id, summary: "Evento editado" });
    // A draft that stays a draft is not on the site: no rebuild, Historial still records the edit.
    if (shouldRebuildSite(saved.wasPublished, saved.isPublished)) {
      requestSiteRebuild();
    }

    revalidatePath(LIST_PATH);
    revalidatePath(editPath(id));
    return { success: true };
  } catch (error) {
    return mapActionError(error);
  }
}

export async function setEventPublished(id: string, isPublished: boolean): Promise<ActionResult> {
  try {
    const actor = await requireSession();
    await getEventUseCases().setPublished.execute({ id, isPublished: isPublished === true });
    await recordAudit(actor, {
      action: isPublished === true ? "event.publish" : "event.unpublish",
      entityType: "event",
      entityId: id,
      summary: isPublished === true ? "Evento publicado" : "Evento pasado a borrador",
    });
    requestSiteRebuild();
    revalidatePath(LIST_PATH);
    revalidatePath(editPath(id));
    return { success: true };
  } catch (error) {
    return mapActionError(error);
  }
}

/** "Delete" is a move to the trash; the site only needs a rebuild when the item was visible on it. */
export async function trashEvent(id: string): Promise<ActionResult> {
  try {
    const actor = await requireSession();
    const { wasPublished } = await getEventUseCases().trash.execute({ id });
    await recordAudit(actor, { action: "event.trash", entityType: "event", entityId: id, summary: "Evento movido a la papelera" });

    if (wasPublished) {
      requestSiteRebuild();
    }

    revalidatePath(LIST_PATH);
    revalidatePath(TRASH_PATH);
    return { success: true };
  } catch (error) {
    return mapActionError(error);
  }
}

export async function uploadEventPhoto(
  eventId: string,
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const actor = await requireSession();

    // The schema is strict about its keys, so it only sees the file field.
    const fileOnly = new FormData();
    for (const file of formData.getAll("file")) fileOnly.append("file", file);
    const { file } = imageUploadSchema.parse(fileOnly) as { file: File };
    await assertValidImageSignature(file);

    await getEventUseCases().attachPhoto.execute({ eventId, file, alt: String(formData.get("alt") ?? "") });
    await recordAudit(actor, { action: "event.photo_add", entityType: "event", entityId: eventId, summary: "Foto agregada a un evento" });
    requestSiteRebuild();
    revalidatePath(LIST_PATH);
    revalidatePath(editPath(eventId));
    return { success: true };
  } catch (error) {
    return mapActionError(error);
  }
}

export async function updateEventPhotoAlt(
  eventId: string,
  photoId: string,
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const actor = await requireSession();
    await getEventUseCases().updatePhotoAlt.execute({ eventId, photoId, alt: String(formData.get("alt") ?? "") });
    await recordAudit(actor, { action: "event.photo_alt", entityType: "event", entityId: eventId, summary: "Texto alternativo de una foto editado" });
    requestSiteRebuild();
    revalidatePath(editPath(eventId));
    return { success: true };
  } catch (error) {
    return mapActionError(error);
  }
}

export async function moveEventPhoto(
  eventId: string,
  photoId: string,
  direction: "up" | "down",
): Promise<ActionResult> {
  try {
    const actor = await requireSession();

    if (direction !== "up" && direction !== "down") {
      return { error: "Dirección no válida." };
    }

    await getEventUseCases().reorderPhotos.execute({ eventId, photoId, direction });
    await recordAudit(actor, { action: "event.photo_move", entityType: "event", entityId: eventId, summary: "Fotos de un evento reordenadas" });
    requestSiteRebuild();
    revalidatePath(editPath(eventId));
    return { success: true };
  } catch (error) {
    return mapActionError(error);
  }
}

export async function deactivateEventPhoto(eventId: string, photoId: string): Promise<ActionResult> {
  try {
    const actor = await requireSession();
    await getEventUseCases().deactivatePhoto.execute({ eventId, photoId });
    await recordAudit(actor, { action: "event.photo_remove", entityType: "event", entityId: eventId, summary: "Foto de un evento quitada" });
    requestSiteRebuild();
    revalidatePath(LIST_PATH);
    revalidatePath(editPath(eventId));
    return { success: true };
  } catch (error) {
    return mapActionError(error);
  }
}
