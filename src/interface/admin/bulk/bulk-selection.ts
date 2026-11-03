import type { BulkItemResult } from "./bulk-input";
import { pluralize } from "../publication-summary";

export type BulkOperation = "publish" | "unpublish" | "trash";

interface OperationCopy {
  /** The button that starts it. */
  label: string;
  /** The question asked before anything is written. */
  confirm: (count: number) => string;
  /** The button that goes ahead. */
  confirmLabel: string;
  /** "1 elemento publicado" once it went through. */
  done: (count: number) => string;
}

const items = (count: number) => pluralize(count, "elemento", "elementos");

export const OPERATIONS: Record<BulkOperation, OperationCopy> = {
  publish: {
    label: "Publicar",
    confirm: (count) => `¿Publicar ${items(count)}? Aparecerán en el sitio.`,
    confirmLabel: "Sí, publicar",
    done: (count) => `${items(count)} ${count === 1 ? "publicado" : "publicados"}.`,
  },
  unpublish: {
    label: "Pasar a borrador",
    confirm: (count) => `¿Pasar ${items(count)} a borrador? Dejarán de verse en el sitio.`,
    confirmLabel: "Sí, pasar a borrador",
    done: (count) => `${items(count)} ${count === 1 ? "pasado" : "pasados"} a borrador.`,
  },
  trash: {
    label: "Mover a la papelera",
    confirm: (count) => `¿Mover ${items(count)} a la papelera? Podrá restaurarlos desde la papelera; volverán como borrador.`,
    confirmLabel: "Sí, mover",
    done: (count) => `${items(count)} ${count === 1 ? "movido" : "movidos"} a la papelera.`,
  },
};

export function doneMessage(operation: BulkOperation, count: number): string {
  return OPERATIONS[operation].done(count);
}

export function toggle(selected: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(selected);

  if (!next.delete(id)) next.add(id);

  return next;
}

export function selectAll(ids: readonly string[], on: boolean): Set<string> {
  return on ? new Set(ids) : new Set();
}

export interface BulkOutcome {
  /** Still selected: the ones that failed, and any the server said nothing about. */
  remaining: Set<string>;
  okCount: number;
  failures: { id: string; error: string }[];
}

/** What a finished batch leaves behind: successes drop out of the selection, failures stay so they can be retried. */
export function settle(selected: ReadonlySet<string>, results: readonly BulkItemResult[]): BulkOutcome {
  const done = new Set(results.filter((result) => result.ok).map((result) => result.id));

  return {
    remaining: new Set([...selected].filter((id) => !done.has(id))),
    okCount: done.size,
    failures: results.filter((result) => !result.ok).map((result) => ({ id: result.id, error: result.error ?? "No se pudo completar." })),
  };
}
