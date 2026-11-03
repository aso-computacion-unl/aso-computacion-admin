import type { ListCriteria, PublicationCounts } from "@/application/ports/list-criteria";

/** Trashed rows (`deletedAt` set) are invisible to every admin read, count and public read. */
export const LIVE = { deletedAt: null } as const;

type TextMatch = { contains: string; mode: "insensitive" };

/** Prisma passes `contains` to LIKE as is, so `%`, `_` and the escape character itself would act as wildcards. */
const escapeLike = (text: string) => text.replace(/[\\%_]/g, "\\$&");

/** The `where` fragment of a text search: any of `fields` contains the text, ignoring case. Blank text adds nothing. */
export function searchWhere<K extends string>(search: string | undefined, fields: readonly K[]): { OR?: { [P in K]?: TextMatch }[] } {
  const text = search?.trim();

  if (!text) return {};

  return { OR: fields.map((field) => ({ [field]: { contains: escapeLike(text), mode: "insensitive" } }) as { [P in K]?: TextMatch }) };
}

/**
 * Prisma `where` for a list's criteria: live rows only, narrowed by status only when one is asked for
 * and by the search text over `searchFields` when there is one.
 */
export function publicationWhere<K extends string = never>(
  criteria: ListCriteria = {},
  searchFields: readonly K[] = [],
): { deletedAt: null; isPublished?: boolean; OR?: { [P in K]?: TextMatch }[] } {
  const base = criteria.status === undefined ? LIVE : { ...LIVE, isPublished: criteria.status === "published" };

  return { ...base, ...searchWhere(criteria.search, searchFields) };
}

/** Folds a `groupBy isPublished` result into the two totals; a state with no rows is zero. */
export function toPublicationCounts(groups: readonly { isPublished: boolean; _count: { _all: number } }[]): PublicationCounts {
  const countOf = (isPublished: boolean) => groups.find((group) => group.isPublished === isPublished)?._count._all ?? 0;

  return { published: countOf(true), draft: countOf(false) };
}
