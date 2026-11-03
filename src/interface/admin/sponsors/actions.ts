"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requestSiteRebuild } from "@/infrastructure/deploy/deploy-hook";
import { assertValidImageSignature, imageUploadSchema } from "@/interface/validation/image-upload.schema";

import { recordAudit } from "../../audit/record-audit";
import { requireSession } from "../../auth/require-session";
import { mapActionError as mapError, type ActionResult } from "../action-result";
import { TRASH_PATH } from "../trash/paths";
import { parseSponsorFormData } from "./sponsor-form-data";
import { getSponsorUseCases } from "./sponsors-container";

// Every action starts with the session guard, before it reads any input or touches a use case (a
// server action can be POSTed to any page). This content is editor-level: any signed-in user. The
// audit entry is written after the mutation succeeded and can never fail the action. Audit summaries
// name the action only, never the content.

const LIST_PATH = "/admin/sponsors";
const editPath = (id: string) => `${LIST_PATH}/${id}/edit`;

// A sponsor link admits 300 characters.
const SPONSOR_FIELD_MESSAGES = { url: "Use un enlace que empiece con https:// y tenga hasta 300 caracteres." };
const mapActionError = (error: unknown) => mapError(error, SPONSOR_FIELD_MESSAGES);

export async function createSponsor(_prevState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  let id: string;

  try {
    const actor = await requireSession();
    ({ id } = await getSponsorUseCases().create.execute(parseSponsorFormData(formData)));
    await recordAudit(actor, { action: "sponsor.create", entityType: "sponsor", entityId: id, summary: "Aliado creado" });
  } catch (error) {
    return mapActionError(error);
  }

  requestSiteRebuild();
  revalidatePath(LIST_PATH);
  // The logo needs an existing sponsor, so creating continues on its edit page.
  redirect(editPath(id));
}

export async function updateSponsor(id: string, _prevState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const actor = await requireSession();
    await getSponsorUseCases().update.execute({ id, ...parseSponsorFormData(formData) });
    await recordAudit(actor, { action: "sponsor.update", entityType: "sponsor", entityId: id, summary: "Aliado editado" });
    requestSiteRebuild();
    revalidatePath(LIST_PATH);
    revalidatePath(editPath(id));
    return { success: true };
  } catch (error) {
    return mapActionError(error);
  }
}

export async function setSponsorPublished(id: string, isPublished: boolean): Promise<ActionResult> {
  try {
    const actor = await requireSession();
    await getSponsorUseCases().setPublished.execute({ id, isPublished: isPublished === true });
    await recordAudit(actor, {
      action: isPublished === true ? "sponsor.publish" : "sponsor.unpublish",
      entityType: "sponsor",
      entityId: id,
      summary: isPublished === true ? "Aliado publicado" : "Aliado pasado a borrador",
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
export async function trashSponsor(id: string): Promise<ActionResult> {
  try {
    const actor = await requireSession();
    const { wasPublished } = await getSponsorUseCases().trash.execute({ id });
    await recordAudit(actor, { action: "sponsor.trash", entityType: "sponsor", entityId: id, summary: "Aliado movido a la papelera" });

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

export async function moveSponsor(id: string, direction: "up" | "down"): Promise<ActionResult> {
  try {
    const actor = await requireSession();

    if (direction !== "up" && direction !== "down") {
      return { error: "Dirección no válida." };
    }

    await getSponsorUseCases().move.execute({ id, direction });
    await recordAudit(actor, { action: "sponsor.move", entityType: "sponsor", entityId: id, summary: "Aliado reordenado" });
    requestSiteRebuild();
    revalidatePath(LIST_PATH);
    return { success: true };
  } catch (error) {
    return mapActionError(error);
  }
}

export async function uploadSponsorLogo(id: string, _prevState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const actor = await requireSession();

    // The schema is strict about its keys, so it only sees the file field.
    const fileOnly = new FormData();
    for (const file of formData.getAll("file")) fileOnly.append("file", file);
    const { file } = imageUploadSchema.parse(fileOnly) as { file: File };
    await assertValidImageSignature(file);

    await getSponsorUseCases().setLogo.execute({ id, file, alt: String(formData.get("logoAlt") ?? "") });
    await recordAudit(actor, { action: "sponsor.logo_set", entityType: "sponsor", entityId: id, summary: "Logo de un aliado cambiado" });
    requestSiteRebuild();
    revalidatePath(LIST_PATH);
    revalidatePath(editPath(id));
    return { success: true };
  } catch (error) {
    return mapActionError(error);
  }
}

export async function removeSponsorLogo(id: string): Promise<ActionResult> {
  try {
    const actor = await requireSession();
    await getSponsorUseCases().removeLogo.execute({ id });
    await recordAudit(actor, { action: "sponsor.logo_remove", entityType: "sponsor", entityId: id, summary: "Logo de un aliado quitado" });
    requestSiteRebuild();
    revalidatePath(LIST_PATH);
    revalidatePath(editPath(id));
    return { success: true };
  } catch (error) {
    return mapActionError(error);
  }
}
