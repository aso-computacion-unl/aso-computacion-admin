"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requestSiteRebuild } from "@/infrastructure/deploy/deploy-hook";

import { recordAudit } from "../../audit/record-audit";
import { requireSession } from "../../auth/require-session";
import { mapActionError, type ActionResult } from "../action-result";
import { TRASH_PATH } from "../trash/paths";
import { parseSocialLinkFormData } from "./social-form-data";
import { getSocialLinkUseCases } from "./socials-container";

// Every action starts with the session guard, before it reads any input or touches a use case (a
// server action can be POSTed to any page). This content is editor-level: any signed-in user. The
// audit entry is written after the mutation succeeded and can never fail the action.

const LIST_PATH = "/admin/socials";

export async function createSocialLink(_prevState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const actor = await requireSession();
    const { id } = await getSocialLinkUseCases().create.execute(parseSocialLinkFormData(formData));
    await recordAudit(actor, { action: "social.create", entityType: "social", entityId: id, summary: "Red social creada" });
  } catch (error) {
    return mapActionError(error);
  }

  requestSiteRebuild();
  revalidatePath(LIST_PATH);
  redirect(LIST_PATH);
}

export async function updateSocialLink(id: string, _prevState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const actor = await requireSession();
    await getSocialLinkUseCases().update.execute({ id, ...parseSocialLinkFormData(formData) });
    await recordAudit(actor, { action: "social.update", entityType: "social", entityId: id, summary: "Red social editada" });
    requestSiteRebuild();
    revalidatePath(LIST_PATH);
    return { success: true };
  } catch (error) {
    return mapActionError(error);
  }
}

export async function setSocialLinkPublished(id: string, isPublished: boolean): Promise<ActionResult> {
  try {
    const actor = await requireSession();
    await getSocialLinkUseCases().setPublished.execute({ id, isPublished: isPublished === true });
    await recordAudit(actor, {
      action: isPublished === true ? "social.publish" : "social.unpublish",
      entityType: "social",
      entityId: id,
      summary: isPublished === true ? "Red social publicada" : "Red social pasada a borrador",
    });
    requestSiteRebuild();
    revalidatePath(LIST_PATH);
    return { success: true };
  } catch (error) {
    return mapActionError(error);
  }
}

/** "Delete" is a move to the trash; the site only needs a rebuild when the item was visible on it. */
export async function trashSocialLink(id: string): Promise<ActionResult> {
  try {
    const actor = await requireSession();
    const { wasPublished } = await getSocialLinkUseCases().trash.execute({ id });
    await recordAudit(actor, { action: "social.trash", entityType: "social", entityId: id, summary: "Red social movida a la papelera" });

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

export async function moveSocialLink(id: string, direction: "up" | "down"): Promise<ActionResult> {
  try {
    const actor = await requireSession();

    if (direction !== "up" && direction !== "down") {
      return { error: "Dirección no válida." };
    }

    await getSocialLinkUseCases().move.execute({ id, direction });
    await recordAudit(actor, { action: "social.move", entityType: "social", entityId: id, summary: "Red social reordenada" });
    requestSiteRebuild();
    revalidatePath(LIST_PATH);
    return { success: true };
  } catch (error) {
    return mapActionError(error);
  }
}
