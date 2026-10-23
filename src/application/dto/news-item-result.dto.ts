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
  createdAt: Date;
  updatedAt: Date;
}
