import { z } from "zod";

/**
 * The slice of the landing's `src/data/fallback.json` that the seed understands.
 *
 * Every object is strict on purpose. A key the seed does not know is an error,
 * never silently dropped or silently stored: that is what keeps a contact
 * field (phone, age, personal Instagram...) on a board entry from slipping
 * through (S4). Only local images can be seeded, because the seed uploads the
 * file itself; an already-hosted URL has no storage `publicId` to adopt.
 */

/** Normalised form of a text used as a stable key: trimmed, single spaces, case-insensitive. */
export function normalizeSeedKey(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function socialSeedKey(platform: string, url: string): string {
  return `${normalizeSeedKey(platform)} ${normalizeSeedKey(url).replace(/\/+$/, "")}`;
}

const nullableText = z.string().nullable().default(null);

const localImagePath = z
  .string()
  .refine(
    (path) => path.startsWith("/") && !path.includes("://") && !path.includes("\\") && !path.split("/").includes(".."),
    "image url must be a local path under the assets root (e.g. /src/assets/team/ana.jpg)",
  );

const imageSchema = z.strictObject({
  url: localImagePath,
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  alt: z.string(),
});

const eventSchema = z.strictObject({
  slug: z.string(),
  title: z.string(),
  description: nullableText,
  date: nullableText,
  datePrecision: z.enum(["day", "month"]).default("day"),
  type: nullableText,
  commitMessage: nullableText,
  hora: nullableText,
  lugar: nullableText,
  para: nullableText,
  featured: z.boolean().default(false),
  linkUrl: nullableText,
  linkLabel: nullableText,
  highlights: z.array(z.string()).default([]),
  // Accepted so the landing's file parses, never seeded (L36).
  photos: z.array(z.unknown()).default([]),
});

const faqSchema = z.strictObject({ question: z.string(), answer: z.string() });

const pillarSchema = z.strictObject({
  word: z.string(),
  title: z.string(),
  text: z.string(),
  image: imageSchema.nullable().default(null),
});

const socialSchema = z.strictObject({
  platform: z.string(),
  label: z.string(),
  handle: z.string(),
  url: z.string(),
  note: nullableText,
  blurb: nullableText,
});

/** S4: name, role and photo only. Strict, so any other key fails the whole file. */
const boardSchema = z.strictObject({
  name: z.string(),
  role: z.string(),
  photo: imageSchema.nullable().default(null),
});

const settingsSchema = z.strictObject({ tagline: z.string(), description: z.string(), about: z.string() });

const landingSchema = z
  .strictObject({
    version: z.literal(1),
    generatedAt: z.string().optional(),
    events: z.array(eventSchema).default([]),
    faqs: z.array(faqSchema).default([]),
    pillars: z.array(pillarSchema).default([]),
    socials: z.array(socialSchema).default([]),
    board: z.array(boardSchema).default([]),
    settings: settingsSchema.nullable().default(null),
  })
  .superRefine((content, context) => {
    const sections: Array<[string, readonly string[]]> = [
      ["events", content.events.map((event) => normalizeSeedKey(event.slug))],
      ["faqs", content.faqs.map((faq) => normalizeSeedKey(faq.question))],
      ["pillars", content.pillars.map((pillar) => normalizeSeedKey(pillar.word))],
      ["socials", content.socials.map((social) => socialSeedKey(social.platform, social.url))],
      ["board", content.board.map((member) => normalizeSeedKey(member.name))],
    ];

    for (const [section, keys] of sections) {
      keys.forEach((key, index) => {
        if (keys.indexOf(key) !== index) {
          context.addIssue({ code: "custom", path: [section, index], message: "duplicate of an earlier entry (same stable key)" });
        }
      });
    }
  });

export type LandingSeedContent = z.output<typeof landingSchema>;
export type LandingSeedEvent = LandingSeedContent["events"][number];
export type LandingSeedImage = z.output<typeof imageSchema>;

/** The file is not a seedable landing document. Lists where, never the offending values. */
export class SeedSourceError extends Error {
  constructor(readonly issues: readonly string[]) {
    super(`The landing content cannot be seeded:\n${issues.map((issue) => `  - ${issue}`).join("\n")}`);
    this.name = "SeedSourceError";
  }
}

export function parseLandingSeedContent(raw: unknown): LandingSeedContent {
  const parsed = landingSchema.safeParse(raw);

  if (!parsed.success) {
    throw new SeedSourceError(parsed.error.issues.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`));
  }

  return parsed.data;
}
