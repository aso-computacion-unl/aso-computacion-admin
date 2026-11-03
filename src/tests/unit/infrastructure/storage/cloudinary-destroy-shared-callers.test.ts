import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const cloudinaryMocks = vi.hoisted(() => ({ destroy: vi.fn() }));

vi.mock("cloudinary", () => ({
  v2: { config: vi.fn(), uploader: { destroy: cloudinaryMocks.destroy, upload_stream: vi.fn() } },
}));
vi.mock("server-only", () => ({}));

import { destroyStoredImages } from "@/application/use-cases/destroy-stored-images";
import { UploadImageUseCase } from "@/application/use-cases/upload-image.use-case";
import { ImageTooSmallError } from "@/domain";
import { CloudinaryMediaStorage } from "@/infrastructure/storage/cloudinary-media-storage";
import { InMemoryMediaStorage } from "@/tests/fakes/in-memory-media-storage";

/**
 * The cleanup after a delete or a rejected upload treats a file the provider no longer has as
 * gone: `{ result: "not found" }` is a successful delete for these callers, through the real adapter.
 */
describe("callers that tolerate an already-gone image, through CloudinaryMediaStorage", () => {
  beforeEach(() => {
    vi.stubEnv("CLOUDINARY_CLOUD_NAME", "aso-cloud");
    vi.stubEnv("CLOUDINARY_API_KEY", "test-api-key");
    vi.stubEnv("CLOUDINARY_API_SECRET", "test-api-secret");
    cloudinaryMocks.destroy.mockResolvedValue({ result: "not found" });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    cloudinaryMocks.destroy.mockReset();
  });

  it("destroyStoredImages logs nothing when every image is already gone", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await destroyStoredImages(new CloudinaryMediaStorage(), ["a", "b"], "Purged item");

    expect(cloudinaryMocks.destroy).toHaveBeenCalledTimes(2);
    expect(logged).not.toHaveBeenCalled();
  });

  it("UploadImageUseCase still rejects with the too-small error when the rejected asset is already gone", async () => {
    const upload = new InMemoryMediaStorage();
    upload.nextDimensions = { width: 576, height: 1280 };
    const storage = Object.assign(new CloudinaryMediaStorage(), { upload: upload.upload.bind(upload) });
    const file = { name: "photo.jpg", type: "image/jpeg", size: 3, arrayBuffer: async () => new ArrayBuffer(3) };

    await expect(new UploadImageUseCase(storage).execute({ file, folder: "events", minWidth: 1200 })).rejects.toBeInstanceOf(ImageTooSmallError);
    expect(cloudinaryMocks.destroy).toHaveBeenCalledExactlyOnceWith("events/photo.jpg", { resource_type: "image" });
  });
});
