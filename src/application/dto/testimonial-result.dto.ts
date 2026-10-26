/** The photo as the admin shows it; the storage `publicId` stays internal. */
export interface TestimonialPhotoResult {
  url: string;
  width: number;
  height: number;
  alt: string;
}

/** Plain shape returned by testimonial use cases: the quote, who said it and the optional photo. */
export interface TestimonialResult {
  id: string;
  quote: string;
  name: string;
  role: string;
  photo: TestimonialPhotoResult | null;
  sortOrder: number;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}
