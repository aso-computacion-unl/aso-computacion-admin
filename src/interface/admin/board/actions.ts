"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requestSiteRebuild } from "@/infrastructure/deploy/deploy-hook";
import { assertValidImageSignature, imageUploadSchema } from "@/interface/validation/image-upload.schema";

import { recordAudit } from "../../audit/record-audit";
import { requireSession } from "../../auth/require-session";
import { mapActionError, type ActionResult } from "../action-result";
import { TRASH_PATH } from "../trash/paths";
import { parseBoardMemberFormData } from "./board-member-form-data";
import { getBoardMemberUseCases } from "./board-members-container";

// Every action starts with the session guard, before it reads any input or touches a use case (a
// server action can be POSTed to any page). This content is editor-level: any signed-in user. The
// audit entry is written after the mutation succeeded and can never fail the action.

const LIST_PATH = "/admin/board";
const editPath = (id: string) => `${LIST_PATH}/${id}/edit`;

export async function createBoardMember(_prevState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  let id: string;

  try {
    const actor = await requireSession();
    ({ id } = await getBoardMemberUseCases().create.execute(parseBoardMemberFormData(formData)));
    await recordAudit(actor, { action: "board.create", entityType: "board", entityId: id, summary: "Integrante de la directiva creado" });
  } catch (error) {
    return mapActionError(error);
  }

  requestSiteRebuild();
  revalidatePath(LIST_PATH);
  // The photo needs an existing member, so creating continues on its edit page.
  redirect(editPath(id));
}

export async function updateBoardMember(id: string, _prevState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const actor = await requireSession();
    await getBoardMemberUseCases().update.execute({ id, ...parseBoardMemberFormData(formData) });
    await recordAudit(actor, { action: "board.update", entityType: "board", entityId: id, summary: "Integrante de la directiva editado" });
    requestSiteRebuild();
    revalidatePath(LIST_PATH);
    revalidatePath(editPath(id));
    return { success: true };
  } catch (error) {
    return mapActionError(error);
  }
}

export async function setBoardMemberPublished(id: string, isPublished: boolean): Promise<ActionResult> {
  try {
    const actor = await requireSession();
    await getBoardMemberUseCases().setPublished.execute({ id, isPublished: isPublished === true });
    await recordAudit(actor, {
      action: isPublished === true ? "board.publish" : "board.unpublish",
      entityType: "board",
      entityId: id,
      summary: isPublished === true ? "Integrante de la directiva publicado" : "Integrante de la directiva pasado a borrador",
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
export async function trashBoardMember(id: string): Promise<ActionResult> {
  try {
    const actor = await requireSession();
    const { wasPublished } = await getBoardMemberUseCases().trash.execute({ id });
    await recordAudit(actor, { action: "board.trash", entityType: "board", entityId: id, summary: "Integrante de la directiva movido a la papelera" });

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

export async function moveBoardMember(id: string, direction: "up" | "down"): Promise<ActionResult> {
  try {
    const actor = await requireSession();

    if (direction !== "up" && direction !== "down") {
      return { error: "Dirección no válida." };
    }

    await getBoardMemberUseCases().move.execute({ id, direction });
    await recordAudit(actor, { action: "board.move", entityType: "board", entityId: id, summary: "Integrante de la directiva reordenado" });
    requestSiteRebuild();
    revalidatePath(LIST_PATH);
    return { success: true };
  } catch (error) {
    return mapActionError(error);
  }
}

export async function uploadBoardMemberPhoto(id: string, _prevState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const actor = await requireSession();

    // The schema is strict about its keys, so it only sees the file field.
    const fileOnly = new FormData();
    for (const file of formData.getAll("file")) fileOnly.append("file", file);
    const { file } = imageUploadSchema.parse(fileOnly) as { file: File };
    await assertValidImageSignature(file);

    await getBoardMemberUseCases().setPhoto.execute({ id, file, alt: String(formData.get("photoAlt") ?? "") });
    await recordAudit(actor, { action: "board.photo_set", entityType: "board", entityId: id, summary: "Foto de un integrante cambiada" });
    requestSiteRebuild();
    revalidatePath(LIST_PATH);
    revalidatePath(editPath(id));
    return { success: true };
  } catch (error) {
    return mapActionError(error);
  }
}

export async function removeBoardMemberPhoto(id: string): Promise<ActionResult> {
  try {
    const actor = await requireSession();
    await getBoardMemberUseCases().removePhoto.execute({ id });
    await recordAudit(actor, { action: "board.photo_remove", entityType: "board", entityId: id, summary: "Foto de un integrante quitada" });
    requestSiteRebuild();
    revalidatePath(LIST_PATH);
    revalidatePath(editPath(id));
    return { success: true };
  } catch (error) {
    return mapActionError(error);
  }
}
