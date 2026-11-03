import { describe, expect, it, vi } from "vitest";

import { ORPHAN_DELETE_MAX } from "@/application";
import type { BulkItemResult } from "@/interface/admin/bulk/bulk-input";
import { deleteInBatches, splitIntoBatches } from "@/interface/admin/media/orphan-batches";
import type { OrphanDeleteResult } from "@/interface/admin/media/media-input";

const ids = (count: number) => Array.from({ length: count }, (_, index) => `aso/pillars/${index}`);
const okFor = (batch: string[]): OrphanDeleteResult => ({ results: batch.map((id): BulkItemResult => ({ id, ok: true })) });

describe("splitIntoBatches", () => {
  it("cuts the selection into requests the server accepts, keeping the order", () => {
    const batches = splitIntoBatches(ids(ORPHAN_DELETE_MAX * 2 + 2));

    expect(batches.map((batch) => batch.length)).toEqual([ORPHAN_DELETE_MAX, ORPHAN_DELETE_MAX, 2]);
    expect(batches.flat()).toEqual(ids(ORPHAN_DELETE_MAX * 2 + 2));
  });

  it("makes no request for an empty selection", () => {
    expect(splitIntoBatches([])).toEqual([]);
  });
});

describe("deleteInBatches", () => {
  it("sends one request per batch, one after the other, and gathers every image's result", async () => {
    const calls: string[][] = [];
    const run = vi.fn(async (batch: string[]) => {
      calls.push(batch);
      return okFor(batch);
    });

    const outcome = await deleteInBatches(ids(ORPHAN_DELETE_MAX + 1), run);

    expect(calls.map((batch) => batch.length)).toEqual([ORPHAN_DELETE_MAX, 1]);
    expect(outcome.results).toHaveLength(ORPHAN_DELETE_MAX + 1);
    expect(outcome.problem).toBeNull();
  });

  it("keeps the results of the batches that finished when a later request is refused, and stops there", async () => {
    const run = vi.fn(async (batch: string[]): Promise<OrphanDeleteResult> => (run.mock.calls.length === 1 ? okFor(batch) : { error: "Elija entre 1 y 5 imágenes." }));

    const outcome = await deleteInBatches(ids(ORPHAN_DELETE_MAX * 3), run);

    expect(run).toHaveBeenCalledTimes(2);
    expect(outcome.results.every((result) => result.ok)).toBe(true);
    expect(outcome.results).toHaveLength(ORPHAN_DELETE_MAX);
    expect(outcome.problem).toBe("Elija entre 1 y 5 imágenes.");
  });

  it("says deleted images may exist when a request never answers, without calling them failures", async () => {
    const run = vi.fn(async (batch: string[]): Promise<OrphanDeleteResult> => {
      if (run.mock.calls.length === 2) throw new Error("timeout");
      return okFor(batch);
    });

    const outcome = await deleteInBatches(ids(ORPHAN_DELETE_MAX * 3), run);

    expect(run).toHaveBeenCalledTimes(2);
    expect(outcome.results).toHaveLength(ORPHAN_DELETE_MAX);
    expect(outcome.problem).toContain("pueden haberse eliminado");
  });
});
