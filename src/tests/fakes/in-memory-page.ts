import { fetchPage, type Page, type PageRequest } from "@/application/ports/list-criteria";

/** The fakes' version of the repositories' text search: any of the texts contains `search`, ignoring case. Blank matches all. */
export function matchesSearch(search: string | undefined, texts: readonly (string | null | undefined)[]): boolean {
  const needle = search?.trim().toLowerCase();

  return !needle || texts.some((text) => text?.toLowerCase().includes(needle));
}

/** A page of an already ordered, already filtered list, cut the way the Prisma adapters cut it. */
export function pageOf<T>(ordered: readonly T[], request: PageRequest): Promise<Page<T>> {
  return fetchPage(
    request,
    async () => ordered.length,
    async (limit, offset) => ordered.slice(offset, offset + limit),
  );
}
