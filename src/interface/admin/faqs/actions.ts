"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requestSiteRebuild } from "@/infrastructure/deploy/deploy-hook";

import { requireAdminSession } from "../../auth/require-admin-session";
import { mapActionError, type ActionResult } from "../action-result";
import { parseFaqFormData } from "./faq-form-data";
import { getFaqUseCases } from "./faqs-container";

// Every action starts with `await requireAdminSession()`, before it reads any
// input or touches a use case (a server action can be POSTed to any page).

const LIST_PATH = "/admin/faqs";

export async function createFaq(_prevState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    await requireAdminSession();
    await getFaqUseCases().create.execute(parseFaqFormData(formData));
  } catch (error) {
    return mapActionError(error);
  }

  requestSiteRebuild();
  revalidatePath(LIST_PATH);
  redirect(LIST_PATH);
}

export async function updateFaq(id: string, _prevState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    await requireAdminSession();
    await getFaqUseCases().update.execute({ id, ...parseFaqFormData(formData) });
    requestSiteRebuild();
    revalidatePath(LIST_PATH);
    return { success: true };
  } catch (error) {
    return mapActionError(error);
  }
}

export async function setFaqPublished(id: string, isPublished: boolean): Promise<ActionResult> {
  try {
    await requireAdminSession();
    await getFaqUseCases().setPublished.execute({ id, isPublished: isPublished === true });
    requestSiteRebuild();
    revalidatePath(LIST_PATH);
    return { success: true };
  } catch (error) {
    return mapActionError(error);
  }
}

export async function deleteFaq(id: string): Promise<ActionResult> {
  try {
    await requireAdminSession();
    await getFaqUseCases().delete.execute({ id });
    requestSiteRebuild();
    revalidatePath(LIST_PATH);
    return { success: true };
  } catch (error) {
    return mapActionError(error);
  }
}

export async function moveFaq(id: string, direction: "up" | "down"): Promise<ActionResult> {
  try {
    await requireAdminSession();

    if (direction !== "up" && direction !== "down") {
      return { error: "Dirección no válida." };
    }

    await getFaqUseCases().move.execute({ id, direction });
    requestSiteRebuild();
    revalidatePath(LIST_PATH);
    return { success: true };
  } catch (error) {
    return mapActionError(error);
  }
}
