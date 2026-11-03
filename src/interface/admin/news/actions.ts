"use server";

/*
 * News ("Novedades") server actions. The UI binds these; every one is guarded
 * and answers `ActionResult` (`{ success: true }`, `{ error }` or `{ fieldErrors }`),
 * and every successful write asks for a landing rebuild.
 *
 *   createNewsItem(prevState, formData)             -> redirects to /admin/news/<id>/edit on success
 *   updateNewsItem(id, prevState, formData)
 *   setNewsItemPublished(id, isPublished)
 *   deleteNewsItem(id)                              -> also destroys the stored cover
 *   uploadNewsCover(id, prevState, formData)        -> add or replace; destroys the previous cover
 *   removeNewsCover(id)                             -> destroys the stored cover
 *
 * Form fields (create and update, strict: any other key is an error):
 *   title (1-120), summary (1-280), body (1-10000, Markdown subset), isPublished (checkbox "on"),
 *   slug (optional: blank derives it from the title on create, keeps it on update),
 *   publishedAt (optional YYYY-MM-DD: blank is today in Ecuador on create, keeps it on update),
 *   coverAlt (optional: send it only when the form shows the current cover; edits its alt, 1-200)
 * Cover upload form: file (JPEG/PNG/WebP, <= 5 MB, >= 1200 px wide) and coverAlt (1-200, required).
 *
 * Reads for pages: `getAdminNewsItems()` and `getAdminNewsItem(id)` in ./news-admin-read.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { NotFoundError } from "@/application/use-cases/use-case-error";
import { requestSiteRebuild } from "@/infrastructure/deploy/deploy-hook";
import { assertValidImageSignature, imageUploadSchema } from "@/interface/validation/image-upload.schema";

import { requireAdminSession } from "../../auth/require-admin-session";
import { mapActionError as mapError, type ActionResult } from "../action-result";
import { TRASH_PATH } from "../trash/paths";
import { parseNewsFormData } from "./news-form-data";
import { getNewsUseCases } from "./news-container";

// Every action starts with `await requireAdminSession()`, before it reads any
// input or touches a use case (a server action can be POSTed to any page).

const LIST_PATH = "/admin/news";
const editPath = (id: string) => `${LIST_PATH}/${id}/edit`;

const NEWS_FIELD_MESSAGES = {
  summary: "El resumen es obligatorio y admite hasta 280 caracteres.",
  body: "El texto es obligatorio y admite hasta 10000 caracteres.",
  publishedAt: "Indique una fecha de publicación válida.",
  coverAlt: "Describa la portada en 1 a 200 caracteres.",
};

function mapActionError(error: unknown): ActionResult {
  if (error instanceof NotFoundError) {
    return { error: "No se encontró la novedad." };
  }

  return mapError(error, NEWS_FIELD_MESSAGES);
}

export async function createNewsItem(_prevState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  let id: string;

  try {
    await requireAdminSession();
    ({ id } = await getNewsUseCases().create.execute(parseNewsFormData(formData)));
  } catch (error) {
    return mapActionError(error);
  }

  requestSiteRebuild();
  revalidatePath(LIST_PATH);
  // The cover needs an existing item, so creating continues on its edit page.
  redirect(editPath(id));
}

export async function updateNewsItem(id: string, _prevState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    await requireAdminSession();
    await getNewsUseCases().update.execute({ id, ...parseNewsFormData(formData) });
    requestSiteRebuild();
    revalidatePath(LIST_PATH);
    revalidatePath(editPath(id));
    return { success: true };
  } catch (error) {
    return mapActionError(error);
  }
}

export async function setNewsItemPublished(id: string, isPublished: boolean): Promise<ActionResult> {
  try {
    await requireAdminSession();
    await getNewsUseCases().setPublished.execute({ id, isPublished: isPublished === true });
    requestSiteRebuild();
    revalidatePath(LIST_PATH);
    revalidatePath(editPath(id));
    return { success: true };
  } catch (error) {
    return mapActionError(error);
  }
}

/** "Delete" is a move to the trash; the site only needs a rebuild when the item was visible on it. */
export async function trashNewsItem(id: string): Promise<ActionResult> {
  try {
    await requireAdminSession();
    const { wasPublished } = await getNewsUseCases().trash.execute({ id });

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

export async function uploadNewsCover(id: string, _prevState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    await requireAdminSession();

    // The schema is strict about its keys, so it only sees the file field.
    const fileOnly = new FormData();
    for (const file of formData.getAll("file")) fileOnly.append("file", file);
    const { file } = imageUploadSchema.parse(fileOnly) as { file: File };
    await assertValidImageSignature(file);

    await getNewsUseCases().setCover.execute({ id, file, alt: String(formData.get("coverAlt") ?? "") });
    requestSiteRebuild();
    revalidatePath(LIST_PATH);
    revalidatePath(editPath(id));
    return { success: true };
  } catch (error) {
    return mapActionError(error);
  }
}

export async function removeNewsCover(id: string): Promise<ActionResult> {
  try {
    await requireAdminSession();
    await getNewsUseCases().removeCover.execute({ id });
    requestSiteRebuild();
    revalidatePath(LIST_PATH);
    revalidatePath(editPath(id));
    return { success: true };
  } catch (error) {
    return mapActionError(error);
  }
}
