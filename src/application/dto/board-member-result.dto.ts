/** The photo as the admin shows it; the storage `publicId` stays internal. */
export interface BoardMemberPhotoResult {
  url: string;
  width: number;
  height: number;
  alt: string;
}

/** Plain shape returned by board member use cases. Name, role and photo only (S4). */
export interface BoardMemberResult {
  id: string;
  name: string;
  role: string;
  photo: BoardMemberPhotoResult | null;
  sortOrder: number;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}
