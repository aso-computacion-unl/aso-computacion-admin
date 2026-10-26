"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requestSiteRebuild } from "@/infrastructure/deploy/deploy-hook";

import { recordAudit } from "../../audit/record-audit";
import { requireSession } from "../../auth/require-session";
import { mapActionError, type ActionResult } from "../action-result";
import { TRASH_PATH } from "../trash/paths";
import { parseFaqFormData } from "./faq-form-data";
import { getFaqUseCases } from "./faqs-container";

// Every action starts with the session guard, before it reads any input or touches a use case (a
// server action can be POSTed to any page). This content is editor-level: any signed-in user. The
// audit entry is written after the mutation succeeded and can never fail the action.

const LIST_PATH = "/admin/faqs";

export async function createFaq(_prevState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const actor = await requireSession();
    const { id } = await getFaqUseCases().create.execute(parseFaqFormData(formData));
    await recordAudit(actor, { action: "faq.create", entityType: "faq", entityId: id, summary: "Pregunta frecuente creada" });
  } catch (error) {
    return mapActionError(error);
  }

  requestSiteRebuild();
  revalidatePath(LIST_PATH);
  redirect(LIST_PATH);
}

export async function updateFaq(id: string, _prevState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const actor = await requireSession();
    await getFaqUseCases().update.execute({ id, ...parseFaqFormData(formData) });
    await recordAudit(actor, { action: "faq.update", entityType: "faq", entityId: id, summary: "Pregunta frecuente editada" });
    requestSiteRebuild();
    revalidatePath(LIST_PATH);
    return { success: true };
  } catch (error) {
    return mapActionError(error);
  }
}

export async function setFaqPublished(id: string, isPublished: boolean): Promise<ActionResult> {
  try {
    const actor = await requireSession();
    await getFaqUseCases().setPublished.execute({ id, isPublished: isPublished === true });
    await recordAudit(actor, {
      action: isPublished === true ? "faq.publish" : "faq.unpublish",
      entityType: "faq",
      entityId: id,
      summary: isPublished === true ? "Pregunta frecuente publicada" : "Pregunta frecuente pasada a borrador",
    });
    requestSiteRebuild();
    revalidatePath(LIST_PATH);
    return { success: true };
  } catch (error) {
    return mapActionError(error);
  }
}

/** "Delete" is a move to the trash; the site only needs a rebuild when the item was visible on it. */
export async function trashFaq(id: string): Promise<ActionResult> {
  try {
    const actor = await requireSession();
    const { wasPublished } = await getFaqUseCases().trash.execute({ id });
    await recordAudit(actor, { action: "faq.trash", entityType: "faq", entityId: id, summary: "Pregunta frecuente movida a la papelera" });

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

export async function moveFaq(id: string, direction: "up" | "down"): Promise<ActionResult> {
  try {
    const actor = await requireSession();

    if (direction !== "up" && direction !== "down") {
      return { error: "Dirección no válida." };
    }

    await getFaqUseCases().move.execute({ id, direction });
    await recordAudit(actor, { action: "faq.move", entityType: "faq", entityId: id, summary: "Pregunta frecuente reordenada" });
    requestSiteRebuild();
    revalidatePath(LIST_PATH);
    return { success: true };
  } catch (error) {
    return mapActionError(error);
  }
}
