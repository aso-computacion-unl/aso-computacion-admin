import type { ListCriteria, PublicationCounts } from "@/application/ports/list-criteria";

/** Trashed rows (`deletedAt` set) are invisible to every admin read, count and public read. */
export const LIVE = { deletedAt: null } as const;

/** Prisma `where` for a list's criteria: live rows only, narrowed by status only when one is asked for. */
export function publicationWhere(criteria: ListCriteria = {}): { deletedAt: null; isPublished?: boolean } {
  return criteria.status === undefined ? LIVE : { ...LIVE, isPublished: criteria.status === "published" };
}

/** Folds a `groupBy isPublished` result into the two totals; a state with no rows is zero. */
export function toPublicationCounts(groups: readonly { isPublished: boolean; _count: { _all: number } }[]): PublicationCounts {
  const countOf = (isPublished: boolean) => groups.find((group) => group.isPublished === isPublished)?._count._all ?? 0;

  return { published: countOf(true), draft: countOf(false) };
}
