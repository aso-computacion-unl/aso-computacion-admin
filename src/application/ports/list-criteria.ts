export type PublicationStatus = "published" | "draft";

/** What an admin list may be narrowed by. An empty criteria is every row, drafts included. */
export interface ListCriteria {
  status?: PublicationStatus;
  /** Free text matched, case-insensitively, against the list's own text columns. Blank means no search. */
  search?: string;
}

/** Which window of a list is wanted: 1-based page of `pageSize` rows. */
export interface PageRequest {
  page: number;
  pageSize: number;
}

/** One page of a list plus where it sits in the whole: `total` counts every row the criteria matches. */
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

/** What a repository offers to list in pages. The order must be total (ties broken by id), or a row could repeat or vanish between pages. */
export interface PageableRepository<E> {
  listPage(criteria: ListCriteria, request: PageRequest): Promise<Page<E>>;
}

/**
 * The paging arithmetic, written once: counts, clamps the requested page into 1..pageCount (a stale
 * link never shows an empty list) and loads that window. Nothing is loaded when nothing matches.
 */
export async function fetchPage<T>(
  request: PageRequest,
  count: () => Promise<number>,
  load: (limit: number, offset: number) => Promise<T[]>,
): Promise<Page<T>> {
  const { pageSize } = request;

  if (!Number.isInteger(pageSize) || pageSize < 1) {
    throw new RangeError("pageSize must be a positive integer");
  }

  const total = await count();
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const requested = Number.isInteger(request.page) && request.page >= 1 ? request.page : 1;
  const page = Math.min(requested, pageCount);
  const items = total === 0 ? [] : await load(pageSize, (page - 1) * pageSize);

  return { items, total, page, pageSize, pageCount };
}

export interface PublicationCounts {
  published: number;
  draft: number;
}

/** What `CountByStatusUseCase` needs from a repository. */
export interface PublicationCounter {
  /** Rows by publication state, whatever filter the list is showing. */
  countByStatus(): Promise<PublicationCounts>;
}
