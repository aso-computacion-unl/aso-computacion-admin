import type { PublicImage } from "./public-content.dto";

/**
 * Social proof, added to the public JSON (`GET /api/public/content`) as a top-level list.
 * Additive: no existing key changes and `schemaVersion` does not move. Impact figures and
 * testimonials used to travel here too; they are no longer sent, and the landing treats
 * their absence as `[]`. Same rules as the rest of the document: no id, storage id,
 * timestamp, publish flag or sort position (order is the array order).
 */
export interface PublicSponsor {
  name: string;
  /** Always present: a sponsor cannot be published without a logo. */
  logo: PublicImage;
  /** Absolute https URL the logo may link to; `null` renders it without a link. */
  url: string | null;
}

export interface PublicSocialProof {
  /** Published sponsors and allies in admin order. */
  sponsors: PublicSponsor[];
}
