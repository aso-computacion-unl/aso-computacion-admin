import { mapActionError, resultText } from "../action-result";
import type { BulkItemResult } from "./bulk-input";

/**
 * Runs `work` for each id, one after the other, and never stops at a failure: the caller gets a
 * result per item, with the failure mapped to Spanish copy (nothing internal leaks out).
 */
export async function runBulk(ids: readonly string[], work: (id: string) => Promise<void>): Promise<BulkItemResult[]> {
  const results: BulkItemResult[] = [];

  for (const id of ids) {
    try {
      await work(id);
      results.push({ id, ok: true });
    } catch (error) {
      results.push({ id, ok: false, error: resultText(mapActionError(error)) });
    }
  }

  return results;
}
