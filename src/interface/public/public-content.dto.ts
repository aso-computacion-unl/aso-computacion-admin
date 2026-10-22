/**
 * The public JSON the landing build fetches (`GET /api/public/content`).
 *
 * Deliberately smaller than the admin shapes: no `id`, `publicId`, timestamp,
 * publish flag or sort position (order is the array order). The only identifier
 * kept is the event `slug`, which the landing uses as the stable entry id (and
 * to seed its decorative hash). Everything the landing does not render stays
 * out; `public-content.mapper.test.ts` pins the exact keys of every entity.
 */
export interface PublicImage {
  url: string;
  width: number;
  height: number;
  alt: string;
}

export interface PublicEvent {
  slug: string;
  title: string;
  description: string | null;
  /** YYYY-MM-DD; a future date is an upcoming event. */
  date: string | null;
  type: "taller" | "charla" | "evento" | "comunidad" | null;
  commitMessage: string | null;
  hora: string | null;
  lugar: string | null;
  para: string | null;
  featured: boolean;
  linkUrl: string | null;
  linkLabel: string | null;
  highlights: string[];
  /** Active photos in gallery order; empty when the event has none. */
  photos: PublicImage[];
}

export interface PublicFaq {
  question: string;
  answer: string;
}

export interface PublicPillar {
  word: string;
  title: string;
  text: string;
  image: PublicImage | null;
}

export interface PublicSocial {
  platform: string;
  label: string;
  handle: string;
  url: string;
  note: string | null;
  blurb: string | null;
}

/** S4: name, role and photo only. */
export interface PublicBoardMember {
  name: string;
  role: string;
  photo: PublicImage;
}

export interface PublicSiteSettings {
  tagline: string;
  description: string;
  about: string;
}

export interface PublicContentResponse {
  /** Shape version of this document; bumped on a breaking change so the landing can refuse what it does not understand. */
  version: number;
  /** ISO timestamp of when the snapshot was read. */
  generatedAt: string;
  events: PublicEvent[];
  faqs: PublicFaq[];
  pillars: PublicPillar[];
  socials: PublicSocial[];
  board: PublicBoardMember[];
  /** `null` when never saved: the landing keeps its fallback copy. */
  settings: PublicSiteSettings | null;
}
