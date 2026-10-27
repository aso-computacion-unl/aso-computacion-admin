import { beforeEach, describe, expect, it, vi } from "vitest";

const cloudinaryMocks = vi.hoisted(() => ({ config: vi.fn(), resources: vi.fn() }));

vi.mock("cloudinary", () => ({ v2: { config: cloudinaryMocks.config, api: { resources: cloudinaryMocks.resources } } }));
vi.mock("server-only", () => ({}));

import { CloudinaryMediaLibrary } from "@/infrastructure/storage/cloudinary-media-library";

const RESOURCE = { public_id: "aso/pillars/a", secure_url: "https://res.example/a.jpg", width: 1200, height: 800, bytes: 4096, created_at: "2026-10-01T10:00:00Z" };

describe("CloudinaryMediaLibrary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CLOUDINARY_CLOUD_NAME", "aso-cloud");
    vi.stubEnv("CLOUDINARY_API_KEY", "key");
    vi.stubEnv("CLOUDINARY_API_SECRET", "secret");
    vi.stubEnv("CLOUDINARY_FOLDER", "aso");
  });

  it("asks only for the images under the app's folder, one page at a time", async () => {
    cloudinaryMocks.resources.mockResolvedValue({ resources: [RESOURCE], next_cursor: "cur-2" });

    const page = await new CloudinaryMediaLibrary().listAssets({ limit: 24 });

    expect(cloudinaryMocks.resources).toHaveBeenCalledWith({ type: "upload", resource_type: "image", prefix: "aso/", max_results: 24 });
    expect(page).toEqual({
      assets: [{ publicId: "aso/pillars/a", url: "https://res.example/a.jpg", width: 1200, height: 800, bytes: 4096, createdAt: new Date("2026-10-01T10:00:00Z") }],
      nextCursor: "cur-2",
    });
  });

  it("sends the cursor on and reports the last page as having no next cursor", async () => {
    cloudinaryMocks.resources.mockResolvedValue({ resources: [RESOURCE] });

    const page = await new CloudinaryMediaLibrary().listAssets({ cursor: "cur-2", limit: 24 });

    expect(cloudinaryMocks.resources).toHaveBeenCalledWith(expect.objectContaining({ next_cursor: "cur-2" }));
    expect(page.nextCursor).toBeNull();
  });

  it("leaves out a resource the provider reported incompletely", async () => {
    cloudinaryMocks.resources.mockResolvedValue({ resources: [{ ...RESOURCE, bytes: undefined }, { ...RESOURCE, created_at: "not a date" }, RESOURCE] });

    const page = await new CloudinaryMediaLibrary().listAssets({ limit: 24 });

    expect(page.assets).toHaveLength(1);
  });

  it("caps the page size at what the provider allows", async () => {
    cloudinaryMocks.resources.mockResolvedValue({ resources: [] });

    await new CloudinaryMediaLibrary().listAssets({ limit: 9999 });

    expect(cloudinaryMocks.resources).toHaveBeenCalledWith(expect.objectContaining({ max_results: 500 }));
  });

  it("only reads: the provider's write calls are not even mocked", async () => {
    cloudinaryMocks.resources.mockResolvedValue({ resources: [] });

    await expect(new CloudinaryMediaLibrary().listAssets({ limit: 1 })).resolves.toEqual({ assets: [], nextCursor: null });
  });
});
