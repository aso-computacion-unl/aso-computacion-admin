import "server-only";

import { v2 as cloudinary } from "cloudinary";

import type { MediaLibraryPort, StoredAsset, StoredAssetPage } from "@/application/ports/media-library.port";

import { getCloudinaryConfig } from "./cloudinary-config";

const MAX_RESULTS = 500;

interface RawResource {
  public_id?: unknown;
  secure_url?: unknown;
  width?: unknown;
  height?: unknown;
  bytes?: unknown;
  created_at?: unknown;
}

/** The folders between the app's folder and the file name: "aso/pillars/a" is in "pillars", "aso/a" is in "". */
function folderOf(publicId: string, prefix: string): string {
  const path = publicId.startsWith(prefix) ? publicId.slice(prefix.length) : publicId;

  return path.split("/").slice(0, -1).join("/");
}

/** A resource the provider reported incompletely is left out rather than shown half-empty. */
function toAsset(raw: RawResource, prefix: string): StoredAsset | null {
  const createdAt = typeof raw.created_at === "string" ? new Date(raw.created_at) : null;

  if (
    typeof raw.public_id !== "string" ||
    typeof raw.secure_url !== "string" ||
    typeof raw.width !== "number" ||
    typeof raw.height !== "number" ||
    typeof raw.bytes !== "number" ||
    createdAt === null ||
    Number.isNaN(createdAt.getTime())
  ) {
    return null;
  }

  return { publicId: raw.public_id, folder: folderOf(raw.public_id, prefix), url: raw.secure_url, width: raw.width, height: raw.height, bytes: raw.bytes, createdAt };
}

/** Lists the images under the app's own folder with the Admin API. Read only: it never uploads or destroys. */
export class CloudinaryMediaLibrary implements MediaLibraryPort {
  private readonly prefix: string;

  constructor() {
    const config = getCloudinaryConfig();

    this.prefix = `${config.folder}/`;

    cloudinary.config({ cloud_name: config.cloudName, api_key: config.apiKey, api_secret: config.apiSecret });
  }

  async getAsset(publicId: string): Promise<StoredAsset | null> {
    // Anything outside the app's folder is none of this app's business, whatever the id.
    if (!publicId.startsWith(this.prefix)) return null;

    try {
      return toAsset((await cloudinary.api.resource(publicId, { resource_type: "image", type: "upload" })) as RawResource, this.prefix);
    } catch (error) {
      if ((error as { http_code?: unknown } | null)?.http_code === 404) return null;

      throw error;
    }
  }

  async listAssets({ cursor, limit }: { cursor?: string; limit: number }): Promise<StoredAssetPage> {
    const response = (await cloudinary.api.resources({
      type: "upload",
      resource_type: "image",
      prefix: this.prefix,
      max_results: Math.min(Math.max(limit, 1), MAX_RESULTS),
      ...(cursor ? { next_cursor: cursor } : {}),
    })) as { resources?: RawResource[]; next_cursor?: unknown };

    const assets = (response.resources ?? []).flatMap((raw) => {
      const asset = toAsset(raw, this.prefix);

      return asset ? [asset] : [];
    });

    return { assets, nextCursor: typeof response.next_cursor === "string" && response.next_cursor !== "" ? response.next_cursor : null };
  }
}
