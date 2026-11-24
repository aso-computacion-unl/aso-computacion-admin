import { collectValidation, ValidationError } from "./domain-error";
import { requiredText } from "./text";

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

/**
 * The title and the slug of an item, checked together: an explicit slug is
 * checked alongside the title, and one derived from the title is checked only
 * once the title itself is valid, so a bad title never reports a slug issue.
 */
export function titleAndSlug(title: string, slug: string | undefined, titleMaxLength: number): { title: string; slug: string } {
  return collectValidation(
    {
      title: () => requiredText("title", title, titleMaxLength),
      slug: () => (slug === undefined ? undefined : assertSlug(slug)),
    },
    (checked) => ({ title: checked.title, slug: checked.slug ?? assertSlug(slugify(checked.title)) }),
  );
}
