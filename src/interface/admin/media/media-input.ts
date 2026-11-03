import { ORPHAN_DELETE_MAX, type OrphanOutcome } from "@/application";

import type { BulkItemResult } from "../bulk/bulk-input";

/** The ids the app's own uploads get: slash-separated segments of letters, digits, `_`, `-` and `.`. */
const PUBLIC_ID_PATTERN = /^[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*$/;
const PUBLIC_ID_MAX_LENGTH = 255;

/** `.` and `..` match the pattern but are never a real folder: refused so an id cannot climb out of the app's folder. */
const isWellFormed = (id: string) => id.length <= PUBLIC_ID_MAX_LENGTH && PUBLIC_ID_PATTERN.test(id) && !id.split("/").some((segment) => segment === "." || segment === "..");

export type OrphanDeleteResult = { error: string; results?: undefined } | { results: BulkItemResult[]; error?: undefined };

export const ORPHAN_IDS_MESSAGE = `Elija entre 1 y ${ORPHAN_DELETE_MAX} imágenes.`;

/** A list of 1..ORPHAN_DELETE_MAX well-formed image ids. Repeats are dropped (order kept); anything else null. */
export function parseOrphanIds(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  if (!value.every((id) => typeof id === "string" && isWellFormed(id))) return null;

  const unique = [...new Set(value as string[])];

  return unique.length <= ORPHAN_DELETE_MAX ? unique : null;
}

const OUTCOME_ERROR: Record<Exclude<OrphanOutcome, "deleted">, string> = {
  not_found: "La imagen ya no existe.",
  not_managed: "Está en una carpeta que esta revisión no cubre, no se eliminó.",
  too_recent: "Se subió hace menos de 24 horas: puede estar en uso todavía.",
  in_use: "Ahora se usa en un contenido, no se eliminó.",
  failed: "No se pudo eliminar. Intente nuevamente.",
};

export function outcomeResult(publicId: string, outcome: OrphanOutcome): BulkItemResult {
  return outcome === "deleted" ? { id: publicId, ok: true } : { id: publicId, ok: false, error: OUTCOME_ERROR[outcome] };
}
