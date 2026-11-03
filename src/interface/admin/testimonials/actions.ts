"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requestSiteRebuild } from "@/infrastructure/deploy/deploy-hook";
import { assertValidImageSignature, imageUploadSchema } from "@/interface/validation/image-upload.schema";

import { recordAudit } from "../../audit/record-audit";
import { requireSession } from "../../auth/require-session";
import { mapActionError as mapError, type ActionResult } from "../action-result";
import { TRASH_PATH } from "../trash/paths";
import { parseTestimonialFormData } from "./testimonial-form-data";
import { getTestimonialUseCases } from "./testimonials-container";

// Every action starts with the session guard, before it reads any input or touches a use case (a
// server action can be POSTed to any page). This content is editor-level: any signed-in user. The
// audit entry is written after the mutation succeeded and can never fail the action. Audit summaries
// name the action only, never the content.

const LIST_PATH = "/admin/testimonials";
const editPath = (id: string) => `${LIST_PATH}/${id}/edit`;

// A testimonial role admits 80 characters, not the 60 of a board member role.
const TESTIMONIAL_FIELD_MESSAGES = { role: "El cargo o afiliación es obligatorio y admite hasta 80 caracteres." };
const mapActionError = (error: unknown) => mapError(error, TESTIMONIAL_FIELD_MESSAGES);

export async function createTestimonial(_prevState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  let id: string;

  try {
    const actor = await requireSession();
    ({ id } = await getTestimonialUseCases().create.execute(parseTestimonialFormData(formData)));
    await recordAudit(actor, { action: "testimonial.create", entityType: "testimonial", entityId: id, summary: "Testimonio creado" });
  } catch (error) {
    return mapActionError(error);
  }

  requestSiteRebuild();
  revalidatePath(LIST_PATH);
  // The photo needs an existing testimonial, so creating continues on its edit page.
  redirect(editPath(id));
}

export async function updateTestimonial(id: string, _prevState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const actor = await requireSession();
    await getTestimonialUseCases().update.execute({ id, ...parseTestimonialFormData(formData) });
    await recordAudit(actor, { action: "testimonial.update", entityType: "testimonial", entityId: id, summary: "Testimonio editado" });
    requestSiteRebuild();
    revalidatePath(LIST_PATH);
    revalidatePath(editPath(id));
    return { success: true };
  } catch (error) {
    return mapActionError(error);
  }
}

export async function setTestimonialPublished(id: string, isPublished: boolean): Promise<ActionResult> {
  try {
    const actor = await requireSession();
    await getTestimonialUseCases().setPublished.execute({ id, isPublished: isPublished === true });
    await recordAudit(actor, {
      action: isPublished === true ? "testimonial.publish" : "testimonial.unpublish",
      entityType: "testimonial",
      entityId: id,
      summary: isPublished === true ? "Testimonio publicado" : "Testimonio pasado a borrador",
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
export async function trashTestimonial(id: string): Promise<ActionResult> {
  try {
    const actor = await requireSession();
    const { wasPublished } = await getTestimonialUseCases().trash.execute({ id });
    await recordAudit(actor, { action: "testimonial.trash", entityType: "testimonial", entityId: id, summary: "Testimonio movido a la papelera" });

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

export async function moveTestimonial(id: string, direction: "up" | "down"): Promise<ActionResult> {
  try {
    const actor = await requireSession();

    if (direction !== "up" && direction !== "down") {
      return { error: "Dirección no válida." };
    }

    await getTestimonialUseCases().move.execute({ id, direction });
    await recordAudit(actor, { action: "testimonial.move", entityType: "testimonial", entityId: id, summary: "Testimonio reordenado" });
    requestSiteRebuild();
    revalidatePath(LIST_PATH);
    return { success: true };
  } catch (error) {
    return mapActionError(error);
  }
}

export async function uploadTestimonialPhoto(id: string, _prevState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const actor = await requireSession();

    // The schema is strict about its keys, so it only sees the file field.
    const fileOnly = new FormData();
    for (const file of formData.getAll("file")) fileOnly.append("file", file);
    const { file } = imageUploadSchema.parse(fileOnly) as { file: File };
    await assertValidImageSignature(file);

    await getTestimonialUseCases().setPhoto.execute({ id, file, alt: String(formData.get("photoAlt") ?? "") });
    await recordAudit(actor, { action: "testimonial.photo_set", entityType: "testimonial", entityId: id, summary: "Foto de un testimonio cambiada" });
    requestSiteRebuild();
    revalidatePath(LIST_PATH);
    revalidatePath(editPath(id));
    return { success: true };
  } catch (error) {
    return mapActionError(error);
  }
}

export async function removeTestimonialPhoto(id: string): Promise<ActionResult> {
  try {
    const actor = await requireSession();
    await getTestimonialUseCases().removePhoto.execute({ id });
    await recordAudit(actor, { action: "testimonial.photo_remove", entityType: "testimonial", entityId: id, summary: "Foto de un testimonio quitada" });
    requestSiteRebuild();
    revalidatePath(LIST_PATH);
    revalidatePath(editPath(id));
    return { success: true };
  } catch (error) {
    return mapActionError(error);
  }
}
