"use server";

import { revalidatePath } from "next/cache";

import { requestSiteRebuild } from "@/infrastructure/deploy/deploy-hook";

import { recordAudit } from "../../audit/record-audit";
import { requireRole } from "../../auth/require-session";
import { mapActionError as mapError, type ActionResult } from "../action-result";
import { parseSiteSettingsFormData } from "./settings-form-data";
import { getSiteSettingsUseCases } from "./settings-container";

// Every action starts with the session guard, before it reads any input or touches a use case (a
// server action can be POSTed to any page). The site settings are ADMIN only.

const PAGE_PATH = "/admin/settings";

// These limits differ from the shared texts (an event description admits 600, not 300).
const SETTINGS_FIELD_MESSAGES = {
  tagline: "El lema es obligatorio y admite hasta 120 caracteres.",
  description: "La descripción es obligatoria y admite hasta 300 caracteres.",
  about: "El texto «Acerca de» es obligatorio y admite hasta 600 caracteres.",
};

export async function updateSiteSettings(_prevState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const actor = await requireRole("ADMIN");
    await getSiteSettingsUseCases().update.execute(parseSiteSettingsFormData(formData));
    await recordAudit(actor, { action: "settings.update", entityType: "settings", entityId: "site", summary: "Ajustes del sitio actualizados" });
    requestSiteRebuild();
    revalidatePath(PAGE_PATH);
    return { success: true };
  } catch (error) {
    return mapError(error, SETTINGS_FIELD_MESSAGES);
  }
}
