import { TRASH_KINDS, type TrashKind } from "@/application";

/** The content kinds a bulk action may touch: the same seven that can be in the trash. */
export type BulkKind = TrashKind;

/** More than this in one request is refused: each item is its own write and audit entry, run one after the other. */
export const BULK_MAX_ITEMS = 50;

const ID_MAX_LENGTH = 64;

/** What happened to one item. `error` is Spanish copy ready to show. */
export interface BulkItemResult {
  id: string;
  ok: boolean;
  error?: string;
}

/** Either the whole request was refused (`error`), or every item was tried and has its own result. */
export type BulkResult = { error: string; results?: undefined } | { results: BulkItemResult[]; error?: undefined };

export const BULK_KIND_MESSAGE = "El tipo de elemento no es válido.";
export const BULK_IDS_MESSAGE = `Elija entre 1 y ${BULK_MAX_ITEMS} elementos.`;

/** A server action receives whatever the client sends: anything but a known kind is refused. */
export function parseBulkKind(value: unknown): BulkKind | null {
  return TRASH_KINDS.find((kind) => kind === value) ?? null;
}

/** A list of 1..BULK_MAX_ITEMS non-blank ids. Repeats are dropped (order kept); anything else null. */
export function parseBulkIds(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  if (!value.every((id) => typeof id === "string" && id.trim() !== "" && id.length <= ID_MAX_LENGTH)) return null;

  const unique = [...new Set(value as string[])];

  return unique.length <= BULK_MAX_ITEMS ? unique : null;
}

/** Validates the two inputs every bulk action takes, in one place. */
export function parseBulkRequest(kind: unknown, ids: unknown): { kind: BulkKind; ids: string[] } | { error: string } {
  const parsedKind = parseBulkKind(kind);

  if (!parsedKind) return { error: BULK_KIND_MESSAGE };

  const parsedIds = parseBulkIds(ids);

  return parsedIds ? { kind: parsedKind, ids: parsedIds } : { error: BULK_IDS_MESSAGE };
}
