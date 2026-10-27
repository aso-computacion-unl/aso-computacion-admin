import { describe, expect, it, vi } from "vitest";

import type { MediaLibraryPort, MediaUsage, MediaUsageReader, StoredAsset } from "@/application/ports/media-library.port";
import { ListMediaLibraryUseCase, MEDIA_PAGE_SIZE } from "@/application/use-cases/list-media-library.use-case";

const asset = (publicId: string): StoredAsset => ({ publicId, url: `https://img.example/${publicId}.jpg`, width: 1200, height: 800, bytes: 1000, createdAt: new Date("2026-10-01T00:00:00Z") });
const usage = (label: string, hidden = false): MediaUsage => ({ kind: "pillar", id: `id-${label}`, label, hidden });

function build(assets: StoredAsset[], used: Record<string, MediaUsage[]>, nextCursor: string | null = null) {
  const listAssets = vi.fn<MediaLibraryPort["listAssets"]>(async () => ({ assets, nextCursor }));
  const usagesOf = vi.fn<MediaUsageReader["usagesOf"]>(async (ids) => new Map(ids.flatMap((id) => (used[id] ? [[id, used[id]!] as const] : []))));

  return { listAssets, usagesOf, useCase: new ListMediaLibraryUseCase({ listAssets, getAsset: async () => null }, { usagesOf }) };
}

describe("ListMediaLibraryUseCase", () => {
  it("pairs every stored image with the content that uses it, and leaves the unused ones empty", async () => {
    const { useCase } = build([asset("a"), asset("b")], { a: [usage("Pilar uno")] });

    const page = await useCase.execute();

    expect(page.items.map((item) => [item.publicId, item.usedBy.map((use) => use.label)])).toEqual([
      ["a", ["Pilar uno"]],
      ["b", []],
    ]);
  });

  it("asks the storage for one page of the fixed size from the cursor, and the database about exactly those images", async () => {
    const { useCase, listAssets, usagesOf } = build([asset("a"), asset("b")], {}, "next-1");

    const page = await useCase.execute({ cursor: "cur-0" });

    expect(listAssets).toHaveBeenCalledWith({ cursor: "cur-0", limit: MEDIA_PAGE_SIZE });
    expect(usagesOf).toHaveBeenCalledWith(["a", "b"]);
    expect(page.nextCursor).toBe("next-1");
  });

  it("keeps an image used by several rows, including a hidden use", async () => {
    const { useCase } = build([asset("a")], { a: [usage("Visible"), usage("En la papelera", true)] });

    const [item] = (await useCase.execute()).items;

    expect(item!.usedBy.map((use) => use.hidden)).toEqual([false, true]);
  });

  it("returns an empty page without failing when the storage has nothing", async () => {
    const { useCase } = build([], {});

    expect(await useCase.execute()).toEqual({ items: [], nextCursor: null });
  });
});
