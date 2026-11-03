import { ORPHAN_DELETE_MAX } from "@/application";

import type { BulkItemResult } from "../bulk/bulk-input";
import type { OrphanDeleteResult } from "./media-input";

const NO_ANSWER_MESSAGE = "El servidor no respondió. Algunas imágenes pueden haberse eliminado: recargue la página para ver cuáles quedan.";

/** The selection cut into requests the server accepts (ORPHAN_DELETE_MAX each), in order. */
export function splitIntoBatches(ids: readonly string[]): string[][] {
  const batches: string[][] = [];

  for (let start = 0; start < ids.length; start += ORPHAN_DELETE_MAX) batches.push(ids.slice(start, start + ORPHAN_DELETE_MAX));

  return batches;
}

export interface BatchedDeletion {
  /** Every image the finished requests answered for, in order. */
  results: BulkItemResult[];
  /** Why the rest was not tried: a request was refused or never answered. Null when all went through. */
  problem: string | null;
}

/**
 * Runs the batches one after the other, each its own request with its own time limit. A batch that
 * is refused or never answers stops the rest; what earlier batches did is kept, never reported as an error.
 */
export async function deleteInBatches(ids: readonly string[], run: (batch: string[]) => Promise<OrphanDeleteResult>): Promise<BatchedDeletion> {
  const results: BulkItemResult[] = [];

  for (const batch of splitIntoBatches(ids)) {
    let answer: OrphanDeleteResult;

    try {
      answer = await run(batch);
    } catch {
      return { results, problem: NO_ANSWER_MESSAGE };
    }

    if (answer.error !== undefined) return { results, problem: answer.error };

    results.push(...answer.results);
  }

  return { results, problem: null };
}
