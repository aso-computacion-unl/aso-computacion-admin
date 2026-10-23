"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { assertValidImageSignature, imageUploadSchema } from "@/interface/validation/image-upload.schema";

import { requireAdminSession } from "../../auth/require-admin-session";
import { mapActionError, type ActionResult } from "../action-result";
import { parseBoardMemberFormData } from "./board-member-form-data";
import { getBoardMemberUseCases } from "./board-members-container";

// Every action starts with `await requireAdminSession()`, before it reads any
// input or touches a use case (a server action can be POSTed to any page).

const LIST_PATH = "/admin/board";
const editPath = (id: string) => `${LIST_PATH}/${id}/edit`;

export async function createBoardMember(_prevState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  let id: string;

  try {
    await requireAdminSession();
    ({ id } = await getBoardMemberUseCases().create.execute(parseBoardMemberFormData(formData)));
  } catch (error) {
    return mapActionError(error);
  }

  revalidatePath(LIST_PATH);
  // The photo needs an existing member, so creating continues on its edit page.
  redirect(editPath(id));
}

export async function updateBoardMember(id: string, _prevState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    await requireAdminSession();
    await getBoardMemberUseCases().update.execute({ id, ...parseBoardMemberFormData(formData) });
    revalidatePath(LIST_PATH);
    revalidatePath(editPath(id));
    return { success: true };
  } catch (error) {
    return mapActionError(error);
  }
}

export async function setBoardMemberPublished(id: string, isPublished: boolean): Promise<ActionResult> {
  try {
    await requireAdminSession();
    await getBoardMemberUseCases().setPublished.execute({ id, isPublished: isPublished === true });
    revalidatePath(LIST_PATH);
    revalidatePath(editPath(id));
    return { success: true };
  } catch (error) {
    return mapActionError(error);
  }
}

export async function deleteBoardMember(id: string): Promise<ActionResult> {
  try {
    await requireAdminSession();
    await getBoardMemberUseCases().delete.execute({ id });
    revalidatePath(LIST_PATH);
    return { success: true };
  } catch (error) {
    return mapActionError(error);
  }
}

export async function moveBoardMember(id: string, direction: "up" | "down"): Promise<ActionResult> {
  try {
    await requireAdminSession();

    if (direction !== "up" && direction !== "down") {
      return { error: "Dirección no válida." };
    }

    await getBoardMemberUseCases().move.execute({ id, direction });
    revalidatePath(LIST_PATH);
    return { success: true };
  } catch (error) {
    return mapActionError(error);
  }
}

export async function uploadBoardMemberPhoto(id: string, _prevState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    await requireAdminSession();

    // The schema is strict about its keys, so it only sees the file field.
    const fileOnly = new FormData();
    for (const file of formData.getAll("file")) fileOnly.append("file", file);
    const { file } = imageUploadSchema.parse(fileOnly) as { file: File };
    await assertValidImageSignature(file);

    await getBoardMemberUseCases().setPhoto.execute({ id, file, alt: String(formData.get("photoAlt") ?? "") });
    revalidatePath(LIST_PATH);
    revalidatePath(editPath(id));
    return { success: true };
  } catch (error) {
    return mapActionError(error);
  }
}

export async function removeBoardMemberPhoto(id: string): Promise<ActionResult> {
  try {
    await requireAdminSession();
    await getBoardMemberUseCases().removePhoto.execute({ id });
    revalidatePath(LIST_PATH);
    revalidatePath(editPath(id));
    return { success: true };
  } catch (error) {
    return mapActionError(error);
  }
}
