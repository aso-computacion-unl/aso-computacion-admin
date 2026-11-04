import { SLUG_MAX_LENGTH, slugify, trimTrailingHyphens } from "@/domain/slug";
import { ValidationError } from "@/domain/domain-error";

import type { EventRepository } from "../ports/event-repository.port";

/**
 * An explicit slug must be free. A derived one is made unique by appending
 * `-2`, `-3`, ... so two events with the same title never block the owner.
 */
export async function resolveEventSlug(
  events: EventRepository,
  title: string,
  explicitSlug: string | undefined,
  excludeId?: string,
): Promise<string> {
  if (explicitSlug !== undefined) {
    if (await events.slugExists(explicitSlug, excludeId)) {
      throw new ValidationError("slug", "slug is already used by another event");
    }

    return explicitSlug;
  }

  // A title with no Latin letters or digits (日本語, 🚀) slugifies to nothing; the item still needs an address.
  const base = slugify(title) || "evento";

  if (!(await events.slugExists(base, excludeId))) {
    return base;
  }

  for (let attempt = 2; ; attempt += 1) {
    const suffix = `-${attempt}`;
    const candidate = `${trimTrailingHyphens(base.slice(0, SLUG_MAX_LENGTH - suffix.length))}${suffix}`;

    if (!(await events.slugExists(candidate, excludeId))) {
      return candidate;
    }
  }
}
