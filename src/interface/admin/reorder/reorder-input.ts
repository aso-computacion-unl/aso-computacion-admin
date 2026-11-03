/** The content kinds that have an order of their own: the five ordered lists. Events and news are sorted by date. */
export const REORDER_KINDS = ["faq", "command", "social", "pillar", "board"] as const;

export type ReorderKind = (typeof REORDER_KINDS)[number];

/** Far beyond any real list; it only keeps a hostile number out of the use case. */
export const REORDER_MAX_POSITION = 10_000;

const ID_MAX_LENGTH = 64;

export const REORDER_KIND_MESSAGE = "Esta lista no se puede reordenar.";
export const REORDER_INPUT_MESSAGE = "No se pudo mover el elemento. Actualice la página e intente nuevamente.";

export function parseReorderKind(value: unknown): ReorderKind | null {
  return REORDER_KINDS.find((kind) => kind === value) ?? null;
}

/** Validates what a drop sends: a known kind, an id and a 0-based place. */
export function parseReorderRequest(kind: unknown, id: unknown, position: unknown): { kind: ReorderKind; id: string; position: number } | { error: string } {
  const parsedKind = parseReorderKind(kind);

  if (!parsedKind) return { error: REORDER_KIND_MESSAGE };

  if (typeof id !== "string" || id.trim() === "" || id.length > ID_MAX_LENGTH) return { error: REORDER_INPUT_MESSAGE };

  if (typeof position !== "number" || !Number.isInteger(position) || position < 0 || position > REORDER_MAX_POSITION) return { error: REORDER_INPUT_MESSAGE };

  return { kind: parsedKind, id, position };
}
