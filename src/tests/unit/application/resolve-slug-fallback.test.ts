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

describe("a taken slug is suffixed within the length limit", () => {
  // 77 letters, a hyphen and "bb": 80 characters, so the "-2" suffix cuts the base right after the hyphen.
  const longTitle = `${"a".repeat(77)} bb`;
  const base = `${"a".repeat(77)}-bb`;

  it.each([
    ["event", (taken: string[]) => resolveEventSlug(takenSlugs(...taken) as unknown as EventRepository, longTitle, undefined)],
    ["news item", (taken: string[]) => resolveNewsSlug(takenSlugs(...taken) as unknown as NewsRepository, longTitle, undefined)],
  ] as const)("drops the hyphen the cut leaves behind for the %s", async (_kind, resolve) => {
    expect(await resolve([])).toBe(base);
    expect(await resolve([base])).toBe(`${"a".repeat(77)}-2`);
    expect(await resolve([base, `${"a".repeat(77)}-2`])).toBe(`${"a".repeat(77)}-3`);
  });

  it("keeps a base that fits as it is", async () => {
    expect(await resolveNewsSlug(takenSlugs("taller") as unknown as NewsRepository, "Taller", undefined)).toBe("taller-2");
  });
});
