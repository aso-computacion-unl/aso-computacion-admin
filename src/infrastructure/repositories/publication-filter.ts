import type { ListCriteria, PublicationCounts } from "@/application/ports/list-criteria";

/** Prisma `where` for a list's criteria: nothing narrows it unless a status is asked for. */
export function publicationWhere(criteria: ListCriteria = {}): { isPublished?: boolean } {
  return criteria.status === undefined ? {} : { isPublished: criteria.status === "published" };
}

/** Folds a `groupBy isPublished` result into the two totals; a state with no rows is zero. */
export function toPublicationCounts(groups: readonly { isPublished: boolean; _count: { _all: number } }[]): PublicationCounts {
  const countOf = (isPublished: boolean) => groups.find((group) => group.isPublished === isPublished)?._count._all ?? 0;

  return { published: countOf(true), draft: countOf(false) };
}
