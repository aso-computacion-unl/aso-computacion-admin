import { describe, expect, it } from "vitest";

import type { EventRepository } from "@/application/ports/event-repository.port";
import type { NewsRepository } from "@/application/ports/news-repository.port";
import { resolveEventSlug } from "@/application/use-cases/resolve-event-slug";
import { resolveNewsSlug } from "@/application/use-cases/resolve-news-slug";

/** Only `slugExists` is read by the resolvers; the taken slugs are the whole fake. */
function takenSlugs(...slugs: string[]) {
  return { slugExists: async (slug: string) => slugs.includes(slug) };
}

describe("a title with no Latin letters or digits", () => {
  it.each([
    ["event", (taken: string[]) => resolveEventSlug(takenSlugs(...taken) as unknown as EventRepository, "日本語🚀", undefined), "evento"],
    ["news item", (taken: string[]) => resolveNewsSlug(takenSlugs(...taken) as unknown as NewsRepository, "🚀", undefined), "noticia"],
  ] as const)("gives the %s a generic slug, suffixed when it is taken", async (_kind, resolve, generic) => {
    expect(await resolve([])).toBe(generic);
    expect(await resolve([generic])).toBe(`${generic}-2`);
    expect(await resolve([generic, `${generic}-2`])).toBe(`${generic}-3`);
  });
});
