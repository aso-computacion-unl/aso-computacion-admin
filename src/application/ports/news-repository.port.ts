import type { NewsItem } from "@/domain/news-item";

import type { ListCriteria, PageableRepository, PublicationCounter } from "./list-criteria";
import type { TrashableRepository } from "./trashable-repository.port";

/** Persistence port for news. Implemented by the Prisma adapter and by an in-memory fake in tests. */
export interface NewsRepository extends PublicationCounter, PageableRepository<NewsItem>, TrashableRepository<NewsItem> {
  create(item: NewsItem): Promise<NewsItem>;
  getById(id: string): Promise<NewsItem | null>;
  /** True when another item (not `excludeId`) already uses the slug. */
  slugExists(slug: string, excludeId?: string): Promise<boolean>;
  /** Every item, drafts included unless `criteria` narrows it: publication date descending, then newest created first. */
  list(criteria?: ListCriteria): Promise<NewsItem[]>;
  // `listPage` (from `PageableRepository`) is the same list in the same order, one window of it, narrowed by `criteria.search` too.
  update(item: NewsItem): Promise<NewsItem>;
  /** Removes a TRASHED item for good. Throws `NotFoundError` unless the item is in the trash. */
  purge(id: string): Promise<void>;
}
