import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MediaLibraryPort, MediaUsage, MediaUsageReader, StoredAsset } from "@/application/ports/media-library.port";
import type { MediaStoragePort } from "@/application/ports/media-storage.port";
import { MANAGED_MEDIA_FOLDERS } from "@/application/media-owners";
import { DeleteOrphanImagesUseCase, FindOrphanImagesUseCase, ORPHAN_MIN_AGE_MS, ORPHAN_SCAN_PAGE_SIZE } from "@/application/use-cases/media-orphans.use-cases";

const NOW = new Date("2026-10-26T12:00:00Z");
const OLD = new Date(NOW.getTime() - ORPHAN_MIN_AGE_MS - 1000);
const YOUNG = new Date(NOW.getTime() - ORPHAN_MIN_AGE_MS + 60_000);
const asset = (publicId: string, createdAt = OLD, folder = "pillars"): StoredAsset => ({ publicId, folder, url: `https://img.example/${publicId}.jpg`, width: 10, height: 10, bytes: 1, createdAt });
const use: MediaUsage = { kind: "pillar", id: "p1", label: "Pilar", hidden: false };

function build(stored: StoredAsset[], used: string[] = []) {
  const library: MediaLibraryPort = {
    listAssets: vi.fn(async () => ({ assets: stored, nextCursor: "next" })),
    getAsset: vi.fn(async (publicId: string) => stored.find((item) => item.publicId === publicId) ?? null),
  };
  const usage: MediaUsageReader = { usagesOf: vi.fn(async (ids: readonly string[]) => new Map<string, MediaUsage[]>(ids.filter((id) => used.includes(id)).map((id) => [id, [use]]))) };
  const storage: MediaStoragePort = { upload: vi.fn(), destroy: vi.fn(async () => undefined) };

  return { library, usage, storage, find: new FindOrphanImagesUseCase(library, usage, () => NOW), remove: new DeleteOrphanImagesUseCase(library, usage, storage, () => NOW) };
}

describe("FindOrphanImagesUseCase (the dry run)", () => {
  it("lists the stored images no row points at, with how many it looked at, and the next cursor", async () => {
    const { find, library } = build([asset("a"), asset("b"), asset("c")], ["b"]);

    const scan = await find.execute({ cursor: "c0" });

    expect(library.listAssets).toHaveBeenCalledWith({ cursor: "c0", limit: ORPHAN_SCAN_PAGE_SIZE });
    expect(scan.scanned).toBe(3);
    expect(scan.orphans.map((orphan) => orphan.publicId)).toEqual(["a", "c"]);
    expect(scan.nextCursor).toBe("next");
    expect(scan.notManaged).toBe(0);
  });

  it("never offers an image whose folder holds content the usage reader does not count, and says how many it left out", async () => {
    const { find } = build([asset("a"), asset("testimonials/t", OLD, "testimonials"), asset("sponsors/s", OLD, "sponsors"), asset("root-file", OLD, ""), asset("events/nested", OLD, "events/nested")]);

    const scan = await find.execute();

    expect(scan.orphans.map((orphan) => orphan.publicId)).toEqual(["a"]);
    expect(scan.scanned).toBe(5);
    expect(scan.notManaged).toBe(4);
  });

  it.each(MANAGED_MEDIA_FOLDERS)("looks for unused images in the %s folder", async (folder) => {
    const { find } = build([asset(`${folder}/x`, OLD, folder)]);

    expect((await find.execute()).orphans).toHaveLength(1);
  });

  it("does not even ask the usage reader about the images it will not manage", async () => {
    const { find, usage } = build([asset("a"), asset("t", OLD, "testimonials")]);

    await find.execute();

    expect(usage.usagesOf).toHaveBeenCalledWith(["a"]);
  });

  it("marks an unused image younger than the grace period as not deletable: it may be mid-upload", async () => {
    const { find } = build([asset("old"), asset("young", YOUNG)]);

    expect((await find.execute()).orphans.map((orphan) => [orphan.publicId, orphan.deletable])).toEqual([
      ["old", true],
      ["young", false],
    ]);
  });
});

describe("DeleteOrphanImagesUseCase", () => {
  let fixture: ReturnType<typeof build>;

  beforeEach(() => {
    fixture = build([asset("old"), asset("young", YOUNG), asset("used")], ["used"]);
  });

  it("destroys an unused, old image", async () => {
    expect(await fixture.remove.execute({ publicIds: ["old"] })).toEqual([{ publicId: "old", outcome: "deleted" }]);
    expect(fixture.storage.destroy).toHaveBeenCalledExactlyOnceWith("old");
  });

  it("does not trust the choice: an image that is in use now is kept", async () => {
    expect(await fixture.remove.execute({ publicIds: ["used"] })).toEqual([{ publicId: "used", outcome: "in_use" }]);
    expect(fixture.storage.destroy).not.toHaveBeenCalled();
  });

  it("keeps an image younger than the grace period", async () => {
    expect(await fixture.remove.execute({ publicIds: ["young"] })).toEqual([{ publicId: "young", outcome: "too_recent" }]);
    expect(fixture.storage.destroy).not.toHaveBeenCalled();
  });

  it("skips an id the storage does not have, or that is outside the app's folder", async () => {
    expect(await fixture.remove.execute({ publicIds: ["other-folder/x"] })).toEqual([{ publicId: "other-folder/x", outcome: "not_found" }]);
    expect(fixture.storage.destroy).not.toHaveBeenCalled();
  });

  it.each(["testimonials", "sponsors", "", "events/nested"])("refuses an image in the %j folder even when its id is posted directly", async (folder) => {
    const { remove, storage, usage } = build([asset("posted", OLD, folder)]);

    expect(await remove.execute({ publicIds: ["posted"] })).toEqual([{ publicId: "posted", outcome: "not_managed" }]);
    expect(storage.destroy).not.toHaveBeenCalled();
    expect(usage.usagesOf).not.toHaveBeenCalled();
  });

  it("reports each image and keeps going when one fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { remove, storage } = build([asset("a"), asset("b"), asset("c")]);
    vi.mocked(storage.destroy).mockRejectedValueOnce(new Error("storage down"));

    expect(await remove.execute({ publicIds: ["a", "b", "c"] })).toEqual([
      { publicId: "a", outcome: "failed" },
      { publicId: "b", outcome: "deleted" },
      { publicId: "c", outcome: "deleted" },
    ]);
  });

  it("checks the usage of each image itself, right before destroying it", async () => {
    await fixture.remove.execute({ publicIds: ["old", "used"] });

    expect(fixture.usage.usagesOf).toHaveBeenNthCalledWith(1, ["old"]);
    expect(fixture.usage.usagesOf).toHaveBeenNthCalledWith(2, ["used"]);
  });

  it("treats a lookup failure as a failure of that image only, destroying nothing", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(fixture.library.getAsset).mockRejectedValueOnce(new Error("rate limit"));

    expect(await fixture.remove.execute({ publicIds: ["old"] })).toEqual([{ publicId: "old", outcome: "failed" }]);
    expect(fixture.storage.destroy).not.toHaveBeenCalled();
  });
});
