import { ValidationError } from "./domain-error";

export const SLUG_MAX_LENGTH = 80;

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** `value` without its leading hyphens; a scan instead of `/^-+/`, which backtracks on long runs. */
function trimLeadingHyphens(value: string): string {
  let start = 0;

  while (value[start] === "-") start += 1;

  return value.slice(start);
}

/** `value` without its trailing hyphens; a scan instead of `/-+$/`, which backtracks on long runs. */
export function trimTrailingHyphens(value: string): string {
  let end = value.length;

  while (end > 0 && value[end - 1] === "-") end -= 1;

  return value.slice(0, end);
}

/**
 * Derives a URL slug from free text: accents stripped, lowercase, any run of
 * non-alphanumerics collapsed to one hyphen. Returns "" when nothing usable
 * remains so the caller can ask for an explicit slug.
 */
export function slugify(text: string): string {
  const slug = trimLeadingHyphens(
    trimTrailingHyphens(text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-")),
  ).slice(0, SLUG_MAX_LENGTH);

  return trimTrailingHyphens(slug);
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
