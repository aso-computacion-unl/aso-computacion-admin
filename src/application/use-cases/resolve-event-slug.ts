import { SLUG_MAX_LENGTH, slugify } from "@/domain/slug";
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

  const base = slugify(title);

  if (base === "" || !(await events.slugExists(base, excludeId))) {
    return base;
  }

  for (let attempt = 2; ; attempt += 1) {
    const suffix = `-${attempt}`;
    const candidate = `${base.slice(0, SLUG_MAX_LENGTH - suffix.length).replace(/-+$/, "")}${suffix}`;

    if (!(await events.slugExists(candidate, excludeId))) {
      return candidate;
    }
  }
}
