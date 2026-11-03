import { afterEach, describe, expect, it, vi } from "vitest";

import type { MediaStoragePort } from "@/application/ports/media-storage.port";
import { destroyStoredImages } from "@/application/use-cases/destroy-stored-images";

function storageFailingFor(...failing: string[]): MediaStoragePort {
  return {
    upload: vi.fn(),
    destroy: vi.fn(async (publicId: string) => {
      if (failing.includes(publicId)) throw new Error(`cannot destroy ${publicId}`);

      return "deleted" as const;
    }),
  };
}

describe("destroyStoredImages", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("destroys every image and stays quiet when all of them go", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const storage = storageFailingFor();

    await destroyStoredImages(storage, ["a", "b"], "Purged item");

    expect(storage.destroy).toHaveBeenCalledTimes(2);
    expect(logged).not.toHaveBeenCalled();
  });

  it("does nothing for an item without images", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const storage = storageFailingFor();

    await destroyStoredImages(storage, [], "Purged item");

    expect(storage.destroy).not.toHaveBeenCalled();
    expect(logged).not.toHaveBeenCalled();
  });

  it("keeps going past a failure and logs only the images that were left behind, with the reasons", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const storage = storageFailingFor("b");

    await expect(destroyStoredImages(storage, ["a", "b", "c"], "Purged item")).resolves.toBeUndefined();

    expect(storage.destroy).toHaveBeenCalledTimes(3);
    expect(logged).toHaveBeenCalledOnce();
    expect(logged.mock.calls[0]?.[0]).toBe("Purged item, but could not destroy its stored images: b");
    expect(logged.mock.calls[0]?.[1]).toEqual([new Error("cannot destroy b")]);
  });
});
