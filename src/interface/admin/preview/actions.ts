"use server";

import { formatEcuadorDateTime } from "@/domain/calendar-date";
import { publicOrigin } from "@/infrastructure/auth/auth-config";
import { isPreviewConfigured, signPreviewToken } from "@/infrastructure/preview/preview-token";

import { recordAudit } from "../../audit/record-audit";
import { requireRole } from "../../auth/require-session";
import { mapActionError, type ActionResult } from "../action-result";
import { PREVIEW_ENDPOINT_PATH } from "./preview-paths";
import { parsePreviewLifetime, previewLifetimeLabel } from "./preview-lifetimes";

// The guard comes first, before any input is read (a server action can be POSTed to any page). An Editor
// (or an Admin) may generate a token: it only shows what the editors themselves can already see in this panel.
// The token is a bearer secret: it is returned once to the caller, never stored, never audited, never logged.

/** `token` is shown once; `expiresAt` is Ecuador wall-clock time (`YYYY-MM-DDTHH:mm`). */
export interface PreviewTokenResult extends ActionResult {
  token?: string;
  expiresAt?: string;
  endpoint?: string;
}

const NOT_CONFIGURED_MESSAGE = "La vista previa no está configurada: falta PREVIEW_TOKEN_SECRET en el servidor.";

export async function createPreviewToken(_prevState: PreviewTokenResult | null, formData: FormData): Promise<PreviewTokenResult> {
  try {
    const actor = await requireRole("EDITOR");
    const lifetime = parsePreviewLifetime(formData.get("lifetime"));

    if (!lifetime) {
      return { fieldErrors: { lifetime: "Elija una duración de la lista." } };
    }

    if (!isPreviewConfigured()) {
      return { error: NOT_CONFIGURED_MESSAGE };
    }

    const { token, expiresAt } = await signPreviewToken(lifetime);
    await recordAudit(actor, {
      action: "preview.token_create",
      entityType: "preview",
      // The lifetime key, so the preview page can say when each code expires. Never the token.
      entityId: lifetime,
      summary: `Código de vista previa generado (${previewLifetimeLabel(lifetime)})`,
    });
    const origin = publicOrigin(process.env.AUTH_URL);

    return { success: true, token, expiresAt: formatEcuadorDateTime(expiresAt), ...(origin ? { endpoint: `${origin}${PREVIEW_ENDPOINT_PATH}` } : {}) };
  } catch (error) {
    return mapActionError(error);
  }
}
