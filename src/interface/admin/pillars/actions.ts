"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requestSiteRebuild } from "@/infrastructure/deploy/deploy-hook";
import { assertValidImageSignature, imageUploadSchema } from "@/interface/validation/image-upload.schema";

import { requireAdminSession } from "../../auth/require-admin-session";
import { mapActionError as mapError, type ActionResult } from "../action-result";
import { TRASH_PATH } from "../trash/paths";
import { parsePillarFormData } from "./pillar-form-data";
import { getPillarUseCases } from "./pillars-container";

// Every action starts with `await requireAdminSession()`, before it reads any
// input or touches a use case (a server action can be POSTed to any page).

const LIST_PATH = "/admin/pillars";
const editPath = (id: string) => `${LIST_PATH}/${id}/edit`;

// A pillar title admits 60 characters, not the 120 of an event title.
const PILLAR_FIELD_MESSAGES = { title: "El título es obligatorio y admite hasta 60 caracteres." };
const mapActionError = (error: unknown) => mapError(error, PILLAR_FIELD_MESSAGES);

export async function createPillar(_prevState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  let id: string;

  try {
    await requireAdminSession();
    ({ id } = await getPillarUseCases().create.execute(parsePillarFormData(formData)));
  } catch (error) {
    return mapActionError(error);
  }

  requestSiteRebuild();
  revalidatePath(LIST_PATH);
  // The image needs an existing pillar, so creating continues on its edit page.
  redirect(editPath(id));
}

export async function updatePillar(id: string, _prevState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    await requireAdminSession();
    await getPillarUseCases().update.execute({ id, ...parsePillarFormData(formData) });
    requestSiteRebuild();
    revalidatePath(LIST_PATH);
    revalidatePath(editPath(id));
    return { success: true };
  } catch (error) {
    return mapActionError(error);
  }
}

export async function setPillarPublished(id: string, isPublished: boolean): Promise<ActionResult> {
  try {
    await requireAdminSession();
    await getPillarUseCases().setPublished.execute({ id, isPublished: isPublished === true });
    requestSiteRebuild();
    revalidatePath(LIST_PATH);
    revalidatePath(editPath(id));
    return { success: true };
  } catch (error) {
    return mapActionError(error);
  }
}

/** "Delete" is a move to the trash; the site only needs a rebuild when the item was visible on it. */
export async function trashPillar(id: string): Promise<ActionResult> {
  try {
    await requireAdminSession();
    const { wasPublished } = await getPillarUseCases().trash.execute({ id });

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

export async function movePillar(id: string, direction: "up" | "down"): Promise<ActionResult> {
  try {
    await requireAdminSession();

    if (direction !== "up" && direction !== "down") {
      return { error: "Dirección no válida." };
    }

    await getPillarUseCases().move.execute({ id, direction });
    requestSiteRebuild();
    revalidatePath(LIST_PATH);
    return { success: true };
  } catch (error) {
    return mapActionError(error);
  }
}

export async function uploadPillarImage(id: string, _prevState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    await requireAdminSession();

    // The schema is strict about its keys, so it only sees the file field.
    const fileOnly = new FormData();
    for (const file of formData.getAll("file")) fileOnly.append("file", file);
    const { file } = imageUploadSchema.parse(fileOnly) as { file: File };
    await assertValidImageSignature(file);

    await getPillarUseCases().setImage.execute({ id, file, alt: String(formData.get("imageAlt") ?? "") });
    requestSiteRebuild();
    revalidatePath(LIST_PATH);
    revalidatePath(editPath(id));
    return { success: true };
  } catch (error) {
    return mapActionError(error);
  }
}

export async function removePillarImage(id: string): Promise<ActionResult> {
  try {
    await requireAdminSession();
    await getPillarUseCases().removeImage.execute({ id });
    requestSiteRebuild();
    revalidatePath(LIST_PATH);
    revalidatePath(editPath(id));
    return { success: true };
  } catch (error) {
    return mapActionError(error);
  }
}
