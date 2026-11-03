"use server";

/*
 * Forum category management ("Categorías del foro"), ADMIN only. The UI (T16/T15b) binds these; every
 * one answers `ActionResult` and writes an audit entry after the change succeeded.
 *
 *   createForumCategory(prevState, formData)       fields: name (1-60), description (optional, <= 200), slug (optional)
 *   updateForumCategory(id, prevState, formData)   same fields; blank slug keeps the current one
 *   deleteForumCategory(id)                        refused while the category still has threads
 *
 * Reads for pages: `getAdminForumCategories()` in ./forum-admin-read.
 */

import { revalidatePath } from "next/cache";

import { ForumCategoryNotEmptyError } from "@/application";
import { NotFoundError } from "@/application/use-cases/use-case-error";

import { recordAudit } from "../../audit/record-audit";
import { getForumServices } from "../../forum/forum-container";
import { requireRole } from "../../auth/require-session";
import { mapActionError as mapError, type ActionResult } from "../action-result";
import { parseCategoryFormData } from "./forum-category-form-data";

// Every action starts with the session guard, before it reads any input or touches a use case (a server
// action can be POSTed to any page). Managing forum categories is ADMIN only. Audit summaries carry the
// category's name or id, never a post.

const PAGE_PATH = "/admin/foro";

const CATEGORY_FIELD_MESSAGES = {
  name: "El nombre es obligatorio y admite hasta 60 caracteres.",
  description: "La descripción admite hasta 200 caracteres.",
};

function mapActionError(error: unknown): ActionResult {
  if (error instanceof ForumCategoryNotEmptyError) {
    return { error: "La categoría todavía tiene hilos y no se puede eliminar." };
  }

  if (error instanceof NotFoundError) {
    return { error: "No se encontró la categoría." };
  }

  return mapError(error, CATEGORY_FIELD_MESSAGES);
}

export async function createForumCategory(_prevState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const actor = await requireRole("ADMIN");
    const category = await getForumServices().createCategory.execute(parseCategoryFormData(formData));

    await recordAudit(actor, { action: "forum.category.create", entityType: "forum_category", entityId: category.id, summary: `Categoría del foro creada: ${category.name}` });
    revalidatePath(PAGE_PATH);
    return { success: true };
  } catch (error) {
    return mapActionError(error);
  }
}

export async function updateForumCategory(id: string, _prevState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const actor = await requireRole("ADMIN");
    const category = await getForumServices().updateCategory.execute({ id, ...parseCategoryFormData(formData) });

    await recordAudit(actor, { action: "forum.category.update", entityType: "forum_category", entityId: id, summary: `Categoría del foro actualizada: ${category.name}` });
    revalidatePath(PAGE_PATH);
    return { success: true };
  } catch (error) {
    return mapActionError(error);
  }
}

export async function deleteForumCategory(id: string): Promise<ActionResult> {
  try {
    const actor = await requireRole("ADMIN");

    await getForumServices().deleteCategory.execute({ id });
    await recordAudit(actor, { action: "forum.category.delete", entityType: "forum_category", entityId: id, summary: "Categoría del foro eliminada" });
    revalidatePath(PAGE_PATH);
    return { success: true };
  } catch (error) {
    return mapActionError(error);
  }
}
