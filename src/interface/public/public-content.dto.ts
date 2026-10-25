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
  /** `month`: the day is unknown and `date` is `YYYY-MM-01`. */
  datePrecision: "day" | "month";
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
  /** Terminal topic chosen in the admin (`git help <command>`); `null` keeps the landing's auto-generated one. Additive. */
  command: string | null;
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

/** S6: a published news item. `body` is a Markdown subset the landing renders safely, never as raw HTML. */
export interface PublicNewsItem {
  slug: string;
  title: string;
  summary: string;
  body: string;
  /** YYYY-MM-DD */
  publishedAt: string;
  cover: PublicImage | null;
}

/** A published free terminal command: the landing's shell runs `command` and prints `output`, and lists `description` in `help`. */
export interface PublicTerminalCommand {
  id: string;
  command: string;
  description: string;
  output: string;
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
  /** Published news, newest `publishedAt` first. Additive: a landing built against an admin without it treats it as `[]`. */
  news: PublicNewsItem[];
  /** Published free terminal commands in admin order. Additive: a landing built against an admin without it treats it as `[]`. */
  commands: PublicTerminalCommand[];
}
