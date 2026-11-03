"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requestSiteRebuild } from "@/infrastructure/deploy/deploy-hook";

import { recordAudit } from "../../audit/record-audit";
import { requireSession } from "../../auth/require-session";
import { mapActionError as mapError, type ActionResult } from "../action-result";
import { TRASH_PATH } from "../trash/paths";
import { parseImpactStatFormData } from "./impact-stat-form-data";
import { getImpactStatUseCases } from "./impact-container";

// Every action starts with the session guard, before it reads any input or touches a use case (a
// server action can be POSTed to any page). This content is editor-level: any signed-in user. The
// audit entry is written after the mutation succeeded and can never fail the action. Audit summaries
// name the action only, never the content.

const LIST_PATH = "/admin/impact";
const editPath = (id: string) => `${LIST_PATH}/${id}/edit`;

// A stat label admits 60 characters, not the 40 of a social link label.
const IMPACT_FIELD_MESSAGES = { label: "La descripción es obligatoria y admite hasta 60 caracteres." };
const mapActionError = (error: unknown) => mapError(error, IMPACT_FIELD_MESSAGES);

export async function createImpactStat(_prevState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  let id: string;

  try {
    const actor = await requireSession();
    ({ id } = await getImpactStatUseCases().create.execute(parseImpactStatFormData(formData)));
    await recordAudit(actor, { action: "impact.create", entityType: "impact", entityId: id, summary: "Cifra de impacto creada" });
  } catch (error) {
    return mapActionError(error);
  }

  requestSiteRebuild();
  revalidatePath(LIST_PATH);
  // Like the other lists, creating continues on the edit page of the new item.
  redirect(editPath(id));
}

export async function updateImpactStat(id: string, _prevState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const actor = await requireSession();
    await getImpactStatUseCases().update.execute({ id, ...parseImpactStatFormData(formData) });
    await recordAudit(actor, { action: "impact.update", entityType: "impact", entityId: id, summary: "Cifra de impacto editada" });
    requestSiteRebuild();
    revalidatePath(LIST_PATH);
    revalidatePath(editPath(id));
    return { success: true };
  } catch (error) {
    return mapActionError(error);
  }
}

export async function setImpactStatPublished(id: string, isPublished: boolean): Promise<ActionResult> {
  try {
    const actor = await requireSession();
    await getImpactStatUseCases().setPublished.execute({ id, isPublished: isPublished === true });
    await recordAudit(actor, {
      action: isPublished === true ? "impact.publish" : "impact.unpublish",
      entityType: "impact",
      entityId: id,
      summary: isPublished === true ? "Cifra de impacto publicada" : "Cifra de impacto pasada a borrador",
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
export async function trashImpactStat(id: string): Promise<ActionResult> {
  try {
    const actor = await requireSession();
    const { wasPublished } = await getImpactStatUseCases().trash.execute({ id });
    await recordAudit(actor, { action: "impact.trash", entityType: "impact", entityId: id, summary: "Cifra de impacto movida a la papelera" });

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

export async function moveImpactStat(id: string, direction: "up" | "down"): Promise<ActionResult> {
  try {
    const actor = await requireSession();

    if (direction !== "up" && direction !== "down") {
      return { error: "Dirección no válida." };
    }

    await getImpactStatUseCases().move.execute({ id, direction });
    await recordAudit(actor, { action: "impact.move", entityType: "impact", entityId: id, summary: "Cifra de impacto reordenada" });
    requestSiteRebuild();
    revalidatePath(LIST_PATH);
    return { success: true };
  } catch (error) {
    return mapActionError(error);
  }
}
