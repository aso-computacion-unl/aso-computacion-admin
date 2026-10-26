/** The cover as the admin shows it; the storage `publicId` stays internal. */
export interface NewsCoverResult {
  url: string;
  width: number;
  height: number;
  alt: string;
}

/** Plain shape returned by news use cases, without exposing the entity. */
export interface NewsItemResult {
  id: string;
  slug: string;
  title: string;
  summary: string;
  /** Markdown subset, as written. */
  body: string;
  /** YYYY-MM-DD */
  publishedAt: string;
  cover: NewsCoverResult | null;
  isPublished: boolean;
  /** Public from this instant (inclusive) while published; `null` is already open. */
  publishAt: Date | null;
  /** Public until this instant (exclusive) while published; `null` never closes. */
  unpublishAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
