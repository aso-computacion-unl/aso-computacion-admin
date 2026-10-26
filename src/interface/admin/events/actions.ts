"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requestSiteRebuild } from "@/infrastructure/deploy/deploy-hook";
import { assertValidImageSignature, imageUploadSchema } from "@/interface/validation/image-upload.schema";

import { requireAdminSession } from "../../auth/require-admin-session";
import { mapActionError, type ActionResult } from "../action-result";
import { TRASH_PATH } from "../trash/paths";
import { parseEventFormData } from "./event-form-data";
import { getEventUseCases } from "./events-container";

// Every action starts with `await requireAdminSession()`, before it reads any
// input or touches a use case (a server action can be POSTed to any page).

const LIST_PATH = "/admin/events";
const editPath = (eventId: string) => `${LIST_PATH}/${eventId}/edit`;

export async function createEvent(_prevState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  let id: string;

  try {
    await requireAdminSession();
    ({ id } = await getEventUseCases().create.execute(parseEventFormData(formData)));
  } catch (error) {
    return mapActionError(error);
  }

  requestSiteRebuild();
  revalidatePath(LIST_PATH);
  // Photos need an existing event, so creating continues on its edit page.
  redirect(editPath(id));
}

export async function updateEvent(
  id: string,
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    await requireAdminSession();
    await getEventUseCases().update.execute({ id, ...parseEventFormData(formData) });
    requestSiteRebuild();
    revalidatePath(LIST_PATH);
    revalidatePath(editPath(id));
    return { success: true };
  } catch (error) {
    return mapActionError(error);
  }
}

export async function setEventPublished(id: string, isPublished: boolean): Promise<ActionResult> {
  try {
    await requireAdminSession();
    await getEventUseCases().setPublished.execute({ id, isPublished: isPublished === true });
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
    await requireAdminSession();
    const { wasPublished } = await getEventUseCases().trash.execute({ id });

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
    await requireAdminSession();

    // The schema is strict about its keys, so it only sees the file field.
    const fileOnly = new FormData();
    for (const file of formData.getAll("file")) fileOnly.append("file", file);
    const { file } = imageUploadSchema.parse(fileOnly) as { file: File };
    await assertValidImageSignature(file);

    await getEventUseCases().attachPhoto.execute({ eventId, file, alt: String(formData.get("alt") ?? "") });
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
    await requireAdminSession();
    await getEventUseCases().updatePhotoAlt.execute({ eventId, photoId, alt: String(formData.get("alt") ?? "") });
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
    await requireAdminSession();

    if (direction !== "up" && direction !== "down") {
      return { error: "Dirección no válida." };
    }

    await getEventUseCases().reorderPhotos.execute({ eventId, photoId, direction });
    requestSiteRebuild();
    revalidatePath(editPath(eventId));
    return { success: true };
  } catch (error) {
    return mapActionError(error);
  }
}

export async function deactivateEventPhoto(eventId: string, photoId: string): Promise<ActionResult> {
  try {
    await requireAdminSession();
    await getEventUseCases().deactivatePhoto.execute({ eventId, photoId });
    requestSiteRebuild();
    revalidatePath(LIST_PATH);
    revalidatePath(editPath(eventId));
    return { success: true };
  } catch (error) {
    return mapActionError(error);
  }
}
