/** The logo as the admin shows it; the storage `publicId` stays internal. */
export interface SponsorLogoResult {
  url: string;
  width: number;
  height: number;
  alt: string;
}

/** Plain shape returned by sponsor use cases: name, logo and the optional https link. */
export interface SponsorResult {
  id: string;
  name: string;
  logo: SponsorLogoResult | null;
  url: string | null;
  sortOrder: number;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}
