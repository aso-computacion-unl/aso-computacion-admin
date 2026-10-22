import { describe, expect, it, vi } from "vitest";

import type { MediaStoragePort } from "@/application/ports/media-storage.port";
import { LazyMediaStorage } from "@/infrastructure/storage/lazy-media-storage";

function fakeStorage(): MediaStoragePort {
  return {
    upload: vi.fn().mockResolvedValue({ url: "u", publicId: "p", width: 1, height: 1 }),
    destroy: vi.fn().mockResolvedValue(undefined),
  };
}

vi.mock("server-only", () => ({}));

const file = { name: "a.jpg", type: "image/jpeg", size: 1, arrayBuffer: async () => new ArrayBuffer(1) };

describe("LazyMediaStorage", () => {
  it("does not build the adapter until a method is called", () => {
    const factory = vi.fn(() => {
      throw new Error("Cloudinary configuration is invalid.");
    });

    expect(() => new LazyMediaStorage(factory)).not.toThrow();
    expect(factory).not.toHaveBeenCalled();
  });

  it("builds the adapter once and delegates upload and destroy", async () => {
    const inner = fakeStorage();
    const factory = vi.fn(() => inner);
    const storage = new LazyMediaStorage(factory);

    await expect(storage.upload(file, { folder: "events" })).resolves.toEqual({
      url: "u",
      publicId: "p",
      width: 1,
      height: 1,
    });
    await storage.destroy("p");

    expect(factory).toHaveBeenCalledTimes(1);
    expect(inner.upload).toHaveBeenCalledWith(file, { folder: "events" });
    expect(inner.destroy).toHaveBeenCalledWith("p");
  });

  it("rejects the call when the adapter cannot be built, and retries on the next call", async () => {
    const inner = fakeStorage();
    const factory = vi
      .fn<() => MediaStoragePort>()
      .mockImplementationOnce(() => {
        throw new Error("Cloudinary configuration is invalid.");
      })
      .mockImplementation(() => inner);
    const storage = new LazyMediaStorage(factory);

    await expect(storage.destroy("p")).rejects.toThrow("Cloudinary configuration is invalid.");
    await expect(storage.destroy("p")).resolves.toBeUndefined();
    expect(factory).toHaveBeenCalledTimes(2);
  });
});

describe("admin containers", () => {
  it.each([
    ["events", () => import("@/interface/admin/events/events-container").then((m) => m.getEventUseCases())],
    ["pillars", () => import("@/interface/admin/pillars/pillars-container").then((m) => m.getPillarUseCases())],
    [
      "board",
      () => import("@/interface/admin/board/board-members-container").then((m) => m.getBoardMemberUseCases()),
    ],
  ])("%s builds its use cases without Cloudinary credentials", async (_name, build) => {
    vi.resetModules();
    vi.stubEnv("CLOUDINARY_CLOUD_NAME", "");
    vi.stubEnv("CLOUDINARY_API_KEY", "");
    vi.stubEnv("CLOUDINARY_API_SECRET", "");
    try {
      await expect(build()).resolves.toBeDefined();
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
