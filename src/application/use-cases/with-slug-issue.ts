import { ValidationError } from "@/domain/domain-error";

/**
 * Checks the slug against the repository and builds the entity, then reports both failures in one
 * error: the taken slug first, followed by every rule the entity broke. Either failure alone is
 * rethrown as the original error. Any other error from `build` only surfaces when the slug is free;
 * a taken slug wins over it, as when the slug was checked before building.
 */
async function combineSlugIssue<S, T>(resolveSlug: () => Promise<S>, slugIfTaken: S, build: (slug: S) => T): Promise<T> {
  let slug = slugIfTaken;
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
    if (!taken) throw error;
    if (!(error instanceof ValidationError)) throw taken;

    throw ValidationError.fromIssues([...taken.issues, ...error.issues]);
  }

  if (taken) throw taken;

  return built;
}

/**
 * On create: `build` gets the free slug that `resolveSlug` found, or the explicit `slug` the caller
 * asked for when it is taken. Only an explicit slug can be taken, so with none `build` gets
 * `undefined` and derives one from the title, which never reports a slug issue for a bad title.
 */
export function withSlugIssue<T>(
  resolveSlug: () => Promise<string>,
  slug: string | undefined,
  build: (slug: string | undefined) => T,
): Promise<T> {
  return combineSlugIssue<string | undefined, T>(resolveSlug, slug, build);
}

/**
 * On update: the entity keeps or replaces its own slug, so `build` does not take one;
 * `assertSlugFree` only rejects a requested slug that another item already uses.
 */
export function withSlugChangeIssue<T>(assertSlugFree: () => Promise<unknown>, build: () => T): Promise<T> {
  return combineSlugIssue(
    async () => {
      await assertSlugFree();
    },
    undefined,
    () => build(),
  );
}
