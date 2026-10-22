import { afterEach, describe, expect, it, vi } from "vitest";

type UploadCallback = (
  error: Error | undefined,
  result:
    | {
        secure_url?: string;
        public_id?: string;
        width?: number;
        height?: number;
        format?: string;
      }
    | undefined,
) => void;

interface SimulatedUploadStream {
  end: (buffer: Buffer) => void;
  once: (event: "error", listener: (error: Error) => void) => SimulatedUploadStream;
}

const cloudinaryMocks = vi.hoisted(() => ({
  config: vi.fn(),
  destroy: vi.fn(),
  uploadStream: vi.fn(),
}));

vi.mock("cloudinary", () => ({
  v2: {
    config: cloudinaryMocks.config,
    uploader: {
      destroy: cloudinaryMocks.destroy,
      upload_stream: cloudinaryMocks.uploadStream,
    },
  },
}));
vi.mock("server-only", () => ({}));

import {
  DEFAULT_CLOUDINARY_FOLDER,
  CloudinaryConfigError,
  getCloudinaryConfig,
} from "@/infrastructure/storage/cloudinary-config";
import { CloudinaryMediaStorage } from "@/infrastructure/storage/cloudinary-media-storage";

const TEST_CONFIG = {
  cloudName: "aso-cloud",
  apiKey: "test-api-key",
  apiSecret: "test-api-secret",
};

const EVENTS = { folder: "events" };

function createImageFile(bytes = [1, 2, 3]) {
  return {
    name: "photo.png",
    type: "image/png",
    size: bytes.length,
    arrayBuffer: vi.fn().mockResolvedValue(Uint8Array.from(bytes).buffer),
  };
}

function stubCloudinaryEnvironment(): void {
  vi.stubEnv("CLOUDINARY_CLOUD_NAME", TEST_CONFIG.cloudName);
  vi.stubEnv("CLOUDINARY_API_KEY", TEST_CONFIG.apiKey);
  vi.stubEnv("CLOUDINARY_API_SECRET", TEST_CONFIG.apiSecret);
}

function uploadSucceeds(): void {
  cloudinaryMocks.uploadStream.mockImplementation((_options, callback: UploadCallback) =>
    createSimulatedUploadStream(vi.fn(() => callback(undefined, SUCCESS_RESULT))),
  );
}

function createSimulatedUploadStream(
  end: (buffer: Buffer) => void,
): SimulatedUploadStream & { emitError: (error: Error) => void } {
  let errorListener: ((error: Error) => void) | undefined;
  const stream: SimulatedUploadStream & { emitError: (error: Error) => void } = {
    end,
    once: vi.fn((_event, listener) => {
      errorListener = listener;
      return stream;
    }),
    emitError(error) {
      errorListener?.(error);
    },
  };

  return stream;
}

const SUCCESS_RESULT = {
  secure_url: "https://res.cloudinary.com/aso/image/upload/photo.png",
  public_id: "aso-computacion/events/photo",
  width: 1200,
  height: 800,
  format: "png",
};

describe("CloudinaryMediaStorage", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("uploads a file buffer and maps Cloudinary's secure image response", async () => {
    stubCloudinaryEnvironment();
    const lifecycle: string[] = [];
    cloudinaryMocks.uploadStream.mockImplementation((_options, callback: UploadCallback) => {
      const stream = createSimulatedUploadStream(
        vi.fn((buffer) => {
          lifecycle.push(`end:${buffer.toString("hex")}`);
          callback(undefined, SUCCESS_RESULT);
          lifecycle.push("callback-returned");
        }),
      );

      return stream;
    });

    const result = await new CloudinaryMediaStorage().upload(createImageFile(), EVENTS);

    expect(result).toEqual({
      url: "https://res.cloudinary.com/aso/image/upload/photo.png",
      publicId: "aso-computacion/events/photo",
      width: 1200,
      height: 800,
    });
    expect(cloudinaryMocks.config).toHaveBeenCalledWith({
      cloud_name: TEST_CONFIG.cloudName,
      api_key: TEST_CONFIG.apiKey,
      api_secret: TEST_CONFIG.apiSecret,
    });
    expect(cloudinaryMocks.uploadStream).toHaveBeenCalledWith(
      { resource_type: "image", folder: "aso-computacion/events" },
      expect.any(Function),
    );
    expect(lifecycle).toEqual(["end:010203", "callback-returned"]);
  });

  it("uses the default base folder plus the caller's subfolder", async () => {
    stubCloudinaryEnvironment();
    uploadSucceeds();

    await new CloudinaryMediaStorage().upload(createImageFile(), { folder: "board" });

    expect(DEFAULT_CLOUDINARY_FOLDER).toBe("aso-computacion");
    expect(cloudinaryMocks.uploadStream).toHaveBeenCalledWith(
      { resource_type: "image", folder: "aso-computacion/board" },
      expect.any(Function),
    );
  });

  it("takes the base folder from CLOUDINARY_FOLDER instead of hardcoding it", async () => {
    stubCloudinaryEnvironment();
    vi.stubEnv("CLOUDINARY_FOLDER", "aso-staging");
    uploadSucceeds();

    await new CloudinaryMediaStorage().upload(createImageFile(), { folder: "events/2025" });

    expect(cloudinaryMocks.uploadStream).toHaveBeenCalledWith(
      { resource_type: "image", folder: "aso-staging/events/2025" },
      expect.any(Function),
    );
  });

  it.each(["", "../escape", "/absolute", "events//double", "ev ents", "events/"])(
    "refuses the unsafe subfolder %j without calling Cloudinary",
    async (folder) => {
      stubCloudinaryEnvironment();

      await expect(new CloudinaryMediaStorage().upload(createImageFile(), { folder })).rejects.toThrow(
        "Invalid media folder.",
      );
      expect(cloudinaryMocks.uploadStream).not.toHaveBeenCalled();
    },
  );

  it("fails eagerly in the constructor when the configuration is invalid", () => {
    vi.stubEnv("CLOUDINARY_CLOUD_NAME", undefined);
    expect(() => new CloudinaryMediaStorage()).toThrow(CloudinaryConfigError);
    expect(cloudinaryMocks.config).not.toHaveBeenCalled();
  });

  it("rejects when the upload stream emits an error event during end", async () => {
    stubCloudinaryEnvironment();
    cloudinaryMocks.uploadStream.mockImplementation(() => {
      const stream = createSimulatedUploadStream(
        vi.fn(() => {
          stream.emitError(new Error("Cloudinary unavailable"));
        }),
      );

      return stream;
    });

    await expect(new CloudinaryMediaStorage().upload(createImageFile(), EVENTS)).rejects.toThrow(
      "Cloudinary unavailable",
    );
  });

  it("rejects when upload_stream throws synchronously", async () => {
    stubCloudinaryEnvironment();
    cloudinaryMocks.uploadStream.mockImplementation(() => {
      throw new Error("Cloudinary initialization failed");
    });

    await expect(new CloudinaryMediaStorage().upload(createImageFile(), EVENTS)).rejects.toThrow(
      "Cloudinary initialization failed",
    );
  });

  it("rejects when end throws after a synchronous success callback", async () => {
    stubCloudinaryEnvironment();
    cloudinaryMocks.uploadStream.mockImplementation((_options, callback: UploadCallback) =>
      createSimulatedUploadStream(
        vi.fn(() => {
          callback(undefined, SUCCESS_RESULT);
          throw new Error("Cloudinary stream write failed");
        }),
      ),
    );

    await expect(new CloudinaryMediaStorage().upload(createImageFile(), EVENTS)).rejects.toThrow(
      "Cloudinary stream write failed",
    );
  });

  it("rejects incomplete successful responses after the stream ends", async () => {
    stubCloudinaryEnvironment();
    cloudinaryMocks.uploadStream.mockImplementation((_options, callback: UploadCallback) =>
      createSimulatedUploadStream(
        vi.fn(() => {
          callback(undefined, { secure_url: SUCCESS_RESULT.secure_url });
        }),
      ),
    );

    await expect(new CloudinaryMediaStorage().upload(createImageFile(), EVENTS)).rejects.toThrow(
      "Cloudinary upload returned an incomplete result.",
    );
  });

  it("rejects a result without dimensions instead of reporting unknown sizes", async () => {
    stubCloudinaryEnvironment();
    cloudinaryMocks.uploadStream.mockImplementation((_options, callback: UploadCallback) =>
      createSimulatedUploadStream(
        vi.fn(() => {
          callback(undefined, { secure_url: SUCCESS_RESULT.secure_url, public_id: SUCCESS_RESULT.public_id });
        }),
      ),
    );

    await expect(new CloudinaryMediaStorage().upload(createImageFile(), EVENTS)).rejects.toThrow(
      "Cloudinary upload returned an incomplete result.",
    );
  });

  it("uses the first callback settlement after the stream ends", async () => {
    stubCloudinaryEnvironment();
    cloudinaryMocks.uploadStream.mockImplementation((_options, callback: UploadCallback) =>
      createSimulatedUploadStream(
        vi.fn(() => {
          callback(undefined, SUCCESS_RESULT);
          callback(new Error("late Cloudinary error"), undefined);
        }),
      ),
    );

    await expect(new CloudinaryMediaStorage().upload(createImageFile(), EVENTS)).resolves.toEqual({
      url: SUCCESS_RESULT.secure_url,
      publicId: SUCCESS_RESULT.public_id,
      width: SUCCESS_RESULT.width,
      height: SUCCESS_RESULT.height,
    });
  });

  it("destroys an asset by public ID", async () => {
    stubCloudinaryEnvironment();
    cloudinaryMocks.destroy.mockResolvedValue({ result: "ok" });

    await new CloudinaryMediaStorage().destroy("aso-computacion/events/photo");

    expect(cloudinaryMocks.destroy).toHaveBeenCalledWith("aso-computacion/events/photo", {
      resource_type: "image",
    });
  });
});

describe("Cloudinary configuration", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns values only when every Cloudinary setting is configured", () => {
    stubCloudinaryEnvironment();

    expect(getCloudinaryConfig()).toEqual({ ...TEST_CONFIG, folder: "aso-computacion" });
  });

  it("treats a blank CLOUDINARY_FOLDER as unset", () => {
    stubCloudinaryEnvironment();
    vi.stubEnv("CLOUDINARY_FOLDER", "   ");

    expect(getCloudinaryConfig().folder).toBe(DEFAULT_CLOUDINARY_FOLDER);
  });

  it.each(["../up", "/root", "a//b", "has space"])("rejects the unsafe CLOUDINARY_FOLDER %j", (folder) => {
    stubCloudinaryEnvironment();
    vi.stubEnv("CLOUDINARY_FOLDER", folder);

    expect(() => getCloudinaryConfig()).toThrow(CloudinaryConfigError);
  });

  it("fails without leaking configured secret values", () => {
    const secret = "private-cloudinary-secret";
    vi.stubEnv("CLOUDINARY_CLOUD_NAME", "aso-cloud");
    vi.stubEnv("CLOUDINARY_API_KEY", "test-api-key");
    vi.stubEnv("CLOUDINARY_API_SECRET", secret);
    vi.stubEnv("CLOUDINARY_CLOUD_NAME", undefined);

    expect(() => getCloudinaryConfig()).toThrow(CloudinaryConfigError);
    expect(() => getCloudinaryConfig()).toThrow("Cloudinary configuration is invalid.");
    expect(() => getCloudinaryConfig()).not.toThrow(secret);
  });

  it("rejects placeholder configuration without exposing the supplied secret", () => {
    const secret = "private-cloudinary-secret";
    vi.stubEnv("CLOUDINARY_CLOUD_NAME", "__REPLACE_CLOUDINARY_CLOUD_NAME__");
    vi.stubEnv("CLOUDINARY_API_KEY", "test-api-key");
    vi.stubEnv("CLOUDINARY_API_SECRET", secret);

    expect(() => getCloudinaryConfig()).toThrow(CloudinaryConfigError);
    expect(() => getCloudinaryConfig()).toThrow("Cloudinary configuration is invalid.");
    expect(() => getCloudinaryConfig()).not.toThrow(secret);
  });
});
