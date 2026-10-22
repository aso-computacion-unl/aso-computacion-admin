/** The image as the admin shows it; the storage `publicId` stays internal. */
export interface PillarImageResult {
  url: string;
  width: number;
  height: number;
  alt: string;
}

/** Plain shape returned by pillar use cases, without exposing the entity. */
export interface PillarResult {
  id: string;
  word: string;
  title: string;
  text: string;
  image: PillarImageResult | null;
  sortOrder: number;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}
