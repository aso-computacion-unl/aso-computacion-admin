import type { PublicImage } from "./public-content.dto";

/**
 * S9 social proof, added to the public JSON (`GET /api/public/content`) as three
 * top-level lists. Additive: no existing key changes and `schemaVersion` does
 * not move, so a landing built against an admin without them treats each as `[]`.
 * Same rules as the rest of the document: no id, storage id, timestamp, publish
 * flag or sort position (order is the array order).
 */
export interface PublicImpactStat {
  /** Free text shown big, e.g. "120+" or "3 años". */
  value: string;
  /** What `value` counts, e.g. "Estudiantes en la comunidad". */
  label: string;
}

/** Name, role and an optional photo only: no contact data exists to leak. */
export interface PublicTestimonial {
  quote: string;
  name: string;
  /** Role or affiliation, e.g. "Egresada de Computación". */
  role: string;
  photo: PublicImage | null;
}

export interface PublicSponsor {
  name: string;
  /** Always present: a sponsor cannot be published without a logo. */
  logo: PublicImage;
  /** Absolute https URL the logo may link to; `null` renders it without a link. */
  url: string | null;
}

export interface PublicSocialProof {
  /** Published impact statistics in admin order. */
  impact: PublicImpactStat[];
  /** Published testimonials in admin order. */
  testimonials: PublicTestimonial[];
  /** Published sponsors and allies in admin order. */
  sponsors: PublicSponsor[];
}
