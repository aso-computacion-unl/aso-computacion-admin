"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requestSiteRebuild } from "@/infrastructure/deploy/deploy-hook";
import { assertValidImageSignature, imageUploadSchema } from "@/interface/validation/image-upload.schema";

import { recordAudit } from "../../audit/record-audit";
import { requireSession } from "../../auth/require-session";
import { mapActionError as mapError, type ActionResult } from "../action-result";
import { TRASH_PATH } from "../trash/paths";
import { parsePillarFormData } from "./pillar-form-data";
import { getPillarUseCases } from "./pillars-container";

// Every action starts with the session guard, before it reads any input or touches a use case (a
// server action can be POSTed to any page). This content is editor-level: any signed-in user. The
// audit entry is written after the mutation succeeded and can never fail the action.

const LIST_PATH = "/admin/pillars";
const editPath = (id: string) => `${LIST_PATH}/${id}/edit`;

// A pillar title admits 60 characters, not the 120 of an event title.
const PILLAR_FIELD_MESSAGES = { title: "El título es obligatorio y admite hasta 60 caracteres." };
const mapActionError = (error: unknown) => mapError(error, PILLAR_FIELD_MESSAGES);

export async function createPillar(_prevState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  let id: string;

  try {
    const actor = await requireSession();
    ({ id } = await getPillarUseCases().create.execute(parsePillarFormData(formData)));
    await recordAudit(actor, { action: "pillar.create", entityType: "pillar", entityId: id, summary: "Pilar creado" });
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
    const actor = await requireSession();
    await getPillarUseCases().update.execute({ id, ...parsePillarFormData(formData) });
    await recordAudit(actor, { action: "pillar.update", entityType: "pillar", entityId: id, summary: "Pilar editado" });
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
    const actor = await requireSession();
    await getPillarUseCases().setPublished.execute({ id, isPublished: isPublished === true });
    await recordAudit(actor, {
      action: isPublished === true ? "pillar.publish" : "pillar.unpublish",
      entityType: "pillar",
      entityId: id,
      summary: isPublished === true ? "Pilar publicado" : "Pilar pasado a borrador",
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
export async function trashPillar(id: string): Promise<ActionResult> {
  try {
    const actor = await requireSession();
    const { wasPublished } = await getPillarUseCases().trash.execute({ id });
    await recordAudit(actor, { action: "pillar.trash", entityType: "pillar", entityId: id, summary: "Pilar movido a la papelera" });

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
    const actor = await requireSession();

    if (direction !== "up" && direction !== "down") {
      return { error: "Dirección no válida." };
    }

    await getPillarUseCases().move.execute({ id, direction });
    await recordAudit(actor, { action: "pillar.move", entityType: "pillar", entityId: id, summary: "Pilar reordenado" });
    requestSiteRebuild();
    revalidatePath(LIST_PATH);
    return { success: true };
  } catch (error) {
    return mapActionError(error);
  }
}

export async function uploadPillarImage(id: string, _prevState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const actor = await requireSession();

    // The schema is strict about its keys, so it only sees the file field.
    const fileOnly = new FormData();
    for (const file of formData.getAll("file")) fileOnly.append("file", file);
    const { file } = imageUploadSchema.parse(fileOnly) as { file: File };
    await assertValidImageSignature(file);

    await getPillarUseCases().setImage.execute({ id, file, alt: String(formData.get("imageAlt") ?? "") });
    await recordAudit(actor, { action: "pillar.image_set", entityType: "pillar", entityId: id, summary: "Imagen de un pilar cambiada" });
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
    const actor = await requireSession();
    await getPillarUseCases().removeImage.execute({ id });
    await recordAudit(actor, { action: "pillar.image_remove", entityType: "pillar", entityId: id, summary: "Imagen de un pilar quitada" });
    requestSiteRebuild();
    revalidatePath(LIST_PATH);
    revalidatePath(editPath(id));
    return { success: true };
  } catch (error) {
    return mapActionError(error);
  }
}
