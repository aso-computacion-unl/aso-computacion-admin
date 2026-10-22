import { ValidationError } from "./domain-error";

export const SLUG_MAX_LENGTH = 80;

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Derives a URL slug from free text: accents stripped, lowercase, any run of
 * non-alphanumerics collapsed to one hyphen. Returns "" when nothing usable
 * remains so the caller can ask for an explicit slug.
 */
export function slugify(text: string): string {
  const slug = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX_LENGTH);

  return slug.replace(/-+$/, "");
}

export function assertSlug(slug: string): string {
  if (slug.length > SLUG_MAX_LENGTH || !SLUG_PATTERN.test(slug)) {
    throw new ValidationError(
      "slug",
      `slug must be lowercase letters and digits separated by hyphens (at most ${SLUG_MAX_LENGTH} characters)`,
    );
  }

  return slug;
}
