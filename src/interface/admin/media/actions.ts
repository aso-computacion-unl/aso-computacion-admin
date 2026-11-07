"use server";

import { revalidatePath } from "next/cache";

import { recordAudit } from "../../audit/record-audit";
import { requireRole } from "../../auth/require-session";
import { mapActionError } from "../action-result";
import { getOrphanDeletion } from "./media-container";
import { ORPHAN_IDS_MESSAGE, outcomeResult, parseOrphanIds, type OrphanDeleteResult } from "./media-input";

// This deletes stored files for good, so it is the most restricted action here: ADMIN only, the guard
// before any input is read, never run by itself (it only acts on the ids a person chose from the dry
// run) and it re-checks every image before destroying it. One audit entry per file destroyed.

const CLEANUP_PATH = "/admin/papelera/imagenes";

export async function deleteOrphanImages(publicIds: string[]): Promise<OrphanDeleteResult> {
  try {
    const actor = await requireRole("ADMIN");
    const ids = parseOrphanIds(publicIds);

    if (!ids) return { error: ORPHAN_IDS_MESSAGE };

    const deletions = await getOrphanDeletion().execute({
      publicIds: ids,
      onDeleted: (publicId) => recordAudit(actor, { action: "media.delete_orphan", entityType: "media", entityId: publicId, summary: "Imagen sin uso eliminada" }),
    });

    if (deletions.some(({ outcome }) => outcome === "deleted")) {
      revalidatePath(CLEANUP_PATH);
    }

    return { results: deletions.map(({ publicId, outcome }) => outcomeResult(publicId, outcome)) };
  } catch (error) {
    return mapActionError(error) as OrphanDeleteResult;
  }
}
