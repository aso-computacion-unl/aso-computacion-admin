/** One stored image, as the storage provider reports it. */
export interface StoredAsset {
  readonly publicId: string;
  readonly url: string;
  readonly width: number;
  readonly height: number;
  readonly bytes: number;
  readonly createdAt: Date;
}

export interface StoredAssetPage {
  readonly assets: readonly StoredAsset[];
  /** Opaque cursor of the next page; null on the last one. */
  readonly nextCursor: string | null;
}

/** Reads what is in the storage under the app's folder. It never changes anything. */
export interface MediaLibraryPort {
  listAssets(options: { cursor?: string; limit: number }): Promise<StoredAssetPage>;
  /** One image by id; null when it does not exist or is not under the app's folder. */
  getAsset(publicId: string): Promise<StoredAsset | null>;
}

/** The content a stored image belongs to. */
export type MediaUsageKind = "event" | "news" | "pillar" | "board";

export interface MediaUsage {
  readonly kind: MediaUsageKind;
  /** The id of the owner (the event, the news item, ...). */
  readonly id: string;
  /** The owner's title or name. */
  readonly label: string;
  /** Kept on purpose but not on the site now: a photo taken off an event, or an owner that is in the trash. */
  readonly hidden: boolean;
}

/** Which rows of the database point at a stored image. */
export interface MediaUsageReader {
  usagesOf(publicIds: readonly string[]): Promise<Map<string, MediaUsage[]>>;
}
