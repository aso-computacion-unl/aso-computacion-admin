"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requestSiteRebuild } from "@/infrastructure/deploy/deploy-hook";

import { requireAdminSession } from "../../auth/require-admin-session";
import { mapActionError, type ActionResult } from "../action-result";
import { TRASH_PATH } from "../trash/paths";
import { parseSocialLinkFormData } from "./social-form-data";
import { getSocialLinkUseCases } from "./socials-container";

// Every action starts with `await requireAdminSession()`, before it reads any
// input or touches a use case (a server action can be POSTed to any page).

const LIST_PATH = "/admin/socials";

export async function createSocialLink(_prevState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    await requireAdminSession();
    await getSocialLinkUseCases().create.execute(parseSocialLinkFormData(formData));
  } catch (error) {
    return mapActionError(error);
  }

  requestSiteRebuild();
  revalidatePath(LIST_PATH);
  redirect(LIST_PATH);
}

export async function updateSocialLink(id: string, _prevState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    await requireAdminSession();
    await getSocialLinkUseCases().update.execute({ id, ...parseSocialLinkFormData(formData) });
    requestSiteRebuild();
    revalidatePath(LIST_PATH);
    return { success: true };
  } catch (error) {
    return mapActionError(error);
  }
}

export async function setSocialLinkPublished(id: string, isPublished: boolean): Promise<ActionResult> {
  try {
    await requireAdminSession();
    await getSocialLinkUseCases().setPublished.execute({ id, isPublished: isPublished === true });
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
    await requireAdminSession();
    const { wasPublished } = await getSocialLinkUseCases().trash.execute({ id });

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
    await requireAdminSession();

    if (direction !== "up" && direction !== "down") {
      return { error: "Dirección no válida." };
    }

    await getSocialLinkUseCases().move.execute({ id, direction });
    requestSiteRebuild();
    revalidatePath(LIST_PATH);
    return { success: true };
  } catch (error) {
    return mapActionError(error);
  }
}
