import { beforeEach, describe, expect, it } from "vitest";

import { UploadImageUseCase } from "@/application/use-cases/upload-image.use-case";
import { ImageTooLargeError, ImageTooSmallError, InvalidImageFormatError } from "@/domain";
import { IMAGE_MAX_SIZE_BYTES } from "@/domain/image";
import { InMemoryMediaStorage } from "@/tests/fakes/in-memory-media-storage";

function imageFile(overrides: Partial<{ name: string; type: string; size: number }> = {}) {
  const size = overrides.size ?? 3;

  return {
    name: overrides.name ?? "photo.jpg",
    type: overrides.type ?? "image/jpeg",
    size,
    arrayBuffer: async () => new ArrayBuffer(size),
  };
}

describe("UploadImageUseCase", () => {
  let storage: InMemoryMediaStorage;
  let useCase: UploadImageUseCase;

  beforeEach(() => {
    storage = new InMemoryMediaStorage();
    useCase = new UploadImageUseCase(storage);
  });

  it("stores an image that meets the caller's minimum width and returns the asset", async () => {
    storage.nextDimensions = { width: 1200, height: 800 };

    const result = await useCase.execute({ file: imageFile(), folder: "events", minWidth: 1200 });

    expect(result).toEqual({
      url: "https://storage.test/events/photo.jpg",
      publicId: "events/photo.jpg",
      width: 1200,
      height: 800,
    });
    expect(storage.has("events/photo.jpg")).toBe(true);
    expect(storage.get("events/photo.jpg")?.folder).toBe("events");
    expect(storage.destroyedPublicIds).toEqual([]);
  });

  it("destroys the uploaded asset and rejects when it is narrower than the minimum", async () => {
    storage.nextDimensions = { width: 576, height: 1280 };

    await expect(useCase.execute({ file: imageFile(), folder: "events", minWidth: 1200 })).rejects.toBeInstanceOf(
      ImageTooSmallError,
    );

    expect(storage.destroyedPublicIds).toEqual(["events/photo.jpg"]);
    expect(storage.size).toBe(0);
  });

  it("accepts the same 576 px image when the caller asks for a smaller minimum", async () => {
    storage.nextDimensions = { width: 576, height: 1280 };

    await expect(
      useCase.execute({ file: imageFile(), folder: "board", minWidth: 400 }),
    ).resolves.toMatchObject({ width: 576 });
    expect(storage.size).toBe(1);
  });

  it("surfaces a failed cleanup instead of silently leaving an orphan", async () => {
    storage.nextDimensions = { width: 576, height: 1280 };
    storage.destroyError = new Error("Cloudinary destroy failed");

    await expect(useCase.execute({ file: imageFile(), folder: "events", minWidth: 1200 })).rejects.toThrow(
      "Cloudinary destroy failed",
    );
  });

  it("never uploads a file with an unsupported type", async () => {
    await expect(
      useCase.execute({ file: imageFile({ type: "image/gif" }), folder: "events", minWidth: 1200 }),
    ).rejects.toBeInstanceOf(InvalidImageFormatError);
    expect(storage.size).toBe(0);
  });

  it("never uploads a file over 5 MB", async () => {
    await expect(
      useCase.execute({
        file: imageFile({ size: IMAGE_MAX_SIZE_BYTES + 1 }),
        folder: "events",
        minWidth: 1200,
      }),
    ).rejects.toBeInstanceOf(ImageTooLargeError);
    expect(storage.size).toBe(0);
  });

  it("never deletes anything on a successful upload (no replace side effects)", async () => {
    await useCase.execute({ file: imageFile({ name: "a.jpg" }), folder: "events", minWidth: 1200 });
    await useCase.execute({ file: imageFile({ name: "b.jpg" }), folder: "events", minWidth: 1200 });

    expect(storage.destroyedPublicIds).toEqual([]);
    expect(storage.size).toBe(2);
  });
});
