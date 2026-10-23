import type { NewsItem } from "@/domain/news-item";

/** Persistence port for news. Implemented by the Prisma adapter and by an in-memory fake in tests. */
export interface NewsRepository {
  create(item: NewsItem): Promise<NewsItem>;
  getById(id: string): Promise<NewsItem | null>;
  /** True when another item (not `excludeId`) already uses the slug. */
  slugExists(slug: string, excludeId?: string): Promise<boolean>;
  /** Every item, drafts included: publication date descending, then newest created first. */
  list(): Promise<NewsItem[]>;
  update(item: NewsItem): Promise<NewsItem>;
  /** Throws `NotFoundError` for an unknown item. */
  delete(id: string): Promise<void>;
}
