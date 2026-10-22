"use server";

import { revalidatePath } from "next/cache";

import { requireAdminSession } from "../../auth/require-admin-session";
import { mapActionError as mapError, type ActionResult } from "../action-result";
import { parseSiteSettingsFormData } from "./settings-form-data";
import { getSiteSettingsUseCases } from "./settings-container";

// Every action starts with `await requireAdminSession()`, before it reads any
// input or touches a use case (a server action can be POSTed to any page).

const PAGE_PATH = "/admin/settings";

// These limits differ from the shared texts (an event description admits 600, not 300).
const SETTINGS_FIELD_MESSAGES = {
  tagline: "El lema es obligatorio y admite hasta 120 caracteres.",
  description: "La descripción es obligatoria y admite hasta 300 caracteres.",
  about: "El texto «Acerca de» es obligatorio y admite hasta 600 caracteres.",
};

export async function updateSiteSettings(_prevState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    await requireAdminSession();
    await getSiteSettingsUseCases().update.execute(parseSiteSettingsFormData(formData));
    revalidatePath(PAGE_PATH);
    return { success: true };
  } catch (error) {
    return mapError(error, SETTINGS_FIELD_MESSAGES);
  }
}
