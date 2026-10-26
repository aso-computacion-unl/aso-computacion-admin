"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requestSiteRebuild } from "@/infrastructure/deploy/deploy-hook";

import { recordAudit } from "../../audit/record-audit";
import { requireSession } from "../../auth/require-session";
import { mapActionError, type ActionResult } from "../action-result";
import { TRASH_PATH } from "../trash/paths";
import { parseCommandFormData } from "./command-form-data";
import { getCommandUseCases } from "./commands-container";

// Every action starts with the session guard, before it reads any input or touches a use case (a
// server action can be POSTed to any page). This content is editor-level: any signed-in user. The
// audit entry is written after the mutation succeeded and can never fail the action.

const LIST_PATH = "/admin/commands";

// A free command's description and output have their own limits, unlike the shared wording.
const FIELD_MESSAGES = {
  description: "La descripción es obligatoria y admite hasta 80 caracteres.",
  output: "La respuesta es obligatoria y admite hasta 600 caracteres.",
};

export async function createCommand(_prevState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const actor = await requireSession();
    const { id } = await getCommandUseCases().create.execute(parseCommandFormData(formData));
    await recordAudit(actor, { action: "command.create", entityType: "command", entityId: id, summary: "Comando creado" });
  } catch (error) {
    return mapActionError(error, FIELD_MESSAGES);
  }

  requestSiteRebuild();
  revalidatePath(LIST_PATH);
  redirect(LIST_PATH);
}

export async function updateCommand(id: string, _prevState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const actor = await requireSession();
    await getCommandUseCases().update.execute({ id, ...parseCommandFormData(formData) });
    await recordAudit(actor, { action: "command.update", entityType: "command", entityId: id, summary: "Comando editado" });
    requestSiteRebuild();
    revalidatePath(LIST_PATH);
    return { success: true };
  } catch (error) {
    return mapActionError(error, FIELD_MESSAGES);
  }
}

export async function setCommandPublished(id: string, isPublished: boolean): Promise<ActionResult> {
  try {
    const actor = await requireSession();
    await getCommandUseCases().setPublished.execute({ id, isPublished: isPublished === true });
    await recordAudit(actor, {
      action: isPublished === true ? "command.publish" : "command.unpublish",
      entityType: "command",
      entityId: id,
      summary: isPublished === true ? "Comando publicado" : "Comando pasado a borrador",
    });
    requestSiteRebuild();
    revalidatePath(LIST_PATH);
    return { success: true };
  } catch (error) {
    return mapActionError(error, FIELD_MESSAGES);
  }
}

/** "Delete" is a move to the trash; the site only needs a rebuild when the item was visible on it. */
export async function trashCommand(id: string): Promise<ActionResult> {
  try {
    const actor = await requireSession();
    const { wasPublished } = await getCommandUseCases().trash.execute({ id });
    await recordAudit(actor, { action: "command.trash", entityType: "command", entityId: id, summary: "Comando movido a la papelera" });

    if (wasPublished) {
      requestSiteRebuild();
    }

    revalidatePath(LIST_PATH);
    revalidatePath(TRASH_PATH);
    return { success: true };
  } catch (error) {
    return mapActionError(error, FIELD_MESSAGES);
  }
}

export async function moveCommand(id: string, direction: "up" | "down"): Promise<ActionResult> {
  try {
    const actor = await requireSession();

    if (direction !== "up" && direction !== "down") {
      return { error: "Dirección no válida." };
    }

    await getCommandUseCases().move.execute({ id, direction });
    await recordAudit(actor, { action: "command.move", entityType: "command", entityId: id, summary: "Comando reordenado" });
    requestSiteRebuild();
    revalidatePath(LIST_PATH);
    return { success: true };
  } catch (error) {
    return mapActionError(error, FIELD_MESSAGES);
  }
}
