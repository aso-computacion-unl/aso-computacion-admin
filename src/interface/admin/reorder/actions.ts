"use server";

import { revalidatePath } from "next/cache";

import { requestSiteRebuild } from "@/infrastructure/deploy/deploy-hook";

import { recordAudit } from "../../audit/record-audit";
import { requireSession } from "../../auth/require-session";
import { mapActionError, type ActionResult } from "../action-result";
import { LIST_PATH_BY_KIND } from "../trash/trash-kinds";
import { getReorderTarget } from "./reorder-container";
import { parseReorderRequest } from "./reorder-input";

// The session guard comes first, before any input is read (a server action can be POSTed to any page).
// Dragging an item to a place is the same change as the single-step move buttons, with the same role
// (editor-level) and the same audit entry (`<kind>.move`); the server renumbers the whole list.

const SUMMARY_BY_KIND = {
  faq: "Pregunta frecuente reordenada",
  command: "Comando reordenado",
  social: "Red social reordenada",
  pillar: "Pilar reordenado",
  board: "Integrante de la directiva reordenado",
  impact: "Cifra de impacto reordenada",
  testimonial: "Testimonio reordenado",
  sponsor: "Aliado reordenado",
} as const;

export async function reorderContent(kind: string, id: string, position: number): Promise<ActionResult> {
  try {
    const actor = await requireSession();
    const request = parseReorderRequest(kind, id, position);

    if ("error" in request) return request;

    await getReorderTarget(request.kind).reorder.execute({ id: request.id, position: request.position });
    await recordAudit(actor, { action: `${request.kind}.move`, entityType: request.kind, entityId: request.id, summary: SUMMARY_BY_KIND[request.kind] });
    requestSiteRebuild();
    revalidatePath(LIST_PATH_BY_KIND[request.kind]);
    return { success: true };
  } catch (error) {
    return mapActionError(error);
  }
}
