"use server";

import { revalidatePath } from "next/cache";

import { requestSiteRebuild } from "@/infrastructure/deploy/deploy-hook";

import { recordAudit } from "../../audit/record-audit";
import { requireSession } from "../../auth/require-session";
import { mapActionError } from "../action-result";
import { LIST_PATH_BY_KIND } from "../trash/trash-kinds";
import { TRASH_PATH } from "../trash/paths";
import { getBulkTarget } from "./bulk-container";
import { parseBulkRequest, type BulkResult } from "./bulk-input";
import { runBulk } from "./bulk-run";

// Every action starts with the session guard, before it reads any input or touches a use case (a
// server action can be POSTed to any page). Bulk actions repeat the single-item ones, with the same
// role (editor-level), the same use cases (so every rule applies per item) and one audit entry per
// item that changed. A refused item does not stop the others: the caller gets a result per item.

const NOUN_BY_KIND = {
  event: "evento",
  news: "novedad",
  faq: "pregunta frecuente",
  command: "comando",
  social: "red social",
  pillar: "pilar",
  board: "integrante de la directiva",
  sponsor: "aliado",
} as const;

export async function bulkSetPublished(kind: string, ids: string[], isPublished: boolean): Promise<BulkResult> {
  try {
    const actor = await requireSession();
    const request = parseBulkRequest(kind, ids);

    if ("error" in request) return request;

    const publish = isPublished === true;
    const target = getBulkTarget(request.kind);
    const results = await runBulk(request.ids, async (id) => {
      await target.setPublished.execute({ id, isPublished: publish });
      await recordAudit(actor, {
        action: `${request.kind}.${publish ? "publish" : "unpublish"}`,
        entityType: request.kind,
        entityId: id,
        summary: `${publish ? "Publicado" : "Pasado a borrador"} en lote: ${NOUN_BY_KIND[request.kind]}`,
      });
    });

    if (results.some((result) => result.ok)) {
      requestSiteRebuild();
      revalidatePath(LIST_PATH_BY_KIND[request.kind]);
    }

    return { results };
  } catch (error) {
    return mapActionError(error) as BulkResult;
  }
}

/** "Delete" is a move to the trash; the site only needs a rebuild when an item was visible on it. */
export async function bulkTrash(kind: string, ids: string[]): Promise<BulkResult> {
  try {
    const actor = await requireSession();
    const request = parseBulkRequest(kind, ids);

    if ("error" in request) return request;

    const target = getBulkTarget(request.kind);
    let anyWasPublished = false;
    const results = await runBulk(request.ids, async (id) => {
      const { wasPublished } = await target.trash.execute({ id });
      anyWasPublished ||= wasPublished;
      await recordAudit(actor, {
        action: `${request.kind}.trash`,
        entityType: request.kind,
        entityId: id,
        summary: `Movido a la papelera en lote: ${NOUN_BY_KIND[request.kind]}`,
      });
    });

    if (anyWasPublished) {
      requestSiteRebuild();
    }

    if (results.some((result) => result.ok)) {
      revalidatePath(LIST_PATH_BY_KIND[request.kind]);
      revalidatePath(TRASH_PATH);
    }

    return { results };
  } catch (error) {
    return mapActionError(error) as BulkResult;
  }
}
