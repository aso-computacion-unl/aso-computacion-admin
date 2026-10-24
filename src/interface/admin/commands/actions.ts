"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requestSiteRebuild } from "@/infrastructure/deploy/deploy-hook";

import { requireAdminSession } from "../../auth/require-admin-session";
import { mapActionError, type ActionResult } from "../action-result";
import { parseCommandFormData } from "./command-form-data";
import { getCommandUseCases } from "./commands-container";

// Every action starts with `await requireAdminSession()`, before it reads any
// input or touches a use case (a server action can be POSTed to any page).

const LIST_PATH = "/admin/commands";

// A free command's description and output have their own limits, unlike the shared wording.
const FIELD_MESSAGES = {
  description: "La descripción es obligatoria y admite hasta 80 caracteres.",
  output: "La respuesta es obligatoria y admite hasta 600 caracteres.",
};

export async function createCommand(_prevState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    await requireAdminSession();
    await getCommandUseCases().create.execute(parseCommandFormData(formData));
  } catch (error) {
    return mapActionError(error, FIELD_MESSAGES);
  }

  requestSiteRebuild();
  revalidatePath(LIST_PATH);
  redirect(LIST_PATH);
}

export async function updateCommand(id: string, _prevState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    await requireAdminSession();
    await getCommandUseCases().update.execute({ id, ...parseCommandFormData(formData) });
    requestSiteRebuild();
    revalidatePath(LIST_PATH);
    return { success: true };
  } catch (error) {
    return mapActionError(error, FIELD_MESSAGES);
  }
}

export async function setCommandPublished(id: string, isPublished: boolean): Promise<ActionResult> {
  try {
    await requireAdminSession();
    await getCommandUseCases().setPublished.execute({ id, isPublished: isPublished === true });
    requestSiteRebuild();
    revalidatePath(LIST_PATH);
    return { success: true };
  } catch (error) {
    return mapActionError(error, FIELD_MESSAGES);
  }
}

export async function deleteCommand(id: string): Promise<ActionResult> {
  try {
    await requireAdminSession();
    await getCommandUseCases().delete.execute({ id });
    requestSiteRebuild();
    revalidatePath(LIST_PATH);
    return { success: true };
  } catch (error) {
    return mapActionError(error, FIELD_MESSAGES);
  }
}

export async function moveCommand(id: string, direction: "up" | "down"): Promise<ActionResult> {
  try {
    await requireAdminSession();

    if (direction !== "up" && direction !== "down") {
      return { error: "Dirección no válida." };
    }

    await getCommandUseCases().move.execute({ id, direction });
    requestSiteRebuild();
    revalidatePath(LIST_PATH);
    return { success: true };
  } catch (error) {
    return mapActionError(error, FIELD_MESSAGES);
  }
}
