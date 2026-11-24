import { ValidationError } from "@/domain/domain-error";

/**
 * Checks the slug against the repository and builds the entity, then reports both failures in one
 * error: the taken slug first (as before), followed by every rule the entity broke. Either failure
 * alone is thrown unchanged.
 */
export async function withSlugIssue<S, T>(resolveSlug: () => Promise<S>, fallback: S, build: (slug: S) => T): Promise<T> {
  let slug = fallback;
  let taken: ValidationError | null = null;

  try {
    slug = await resolveSlug();
  } catch (error) {
    if (!(error instanceof ValidationError)) throw error;
    taken = error;
  }

  let built: T;

  try {
    built = build(slug);
  } catch (error) {
    if (!(taken && error instanceof ValidationError)) throw error;
    throw ValidationError.fromIssues([...taken.issues, ...error.issues]);
  }

  if (taken) throw taken;

  return built;
}
