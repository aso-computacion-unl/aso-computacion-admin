import type { NewsRepository } from "@/application/ports/news-repository.port";
import { NotFoundError } from "@/application/use-cases/use-case-error";
import type { NewsItem } from "@/domain/news-item";

/** Deterministic in-memory `NewsRepository`; `list()` mirrors the Prisma ordering (publishedAt desc, then newest created). */
export class InMemoryNewsRepository implements NewsRepository {
  private readonly items = new Map<string, NewsItem>();

  async create(item: NewsItem): Promise<NewsItem> {
    this.items.set(item.props.id, item);
    return item;
  }

  async getById(id: string): Promise<NewsItem | null> {
    return this.items.get(id) ?? null;
  }

  async slugExists(slug: string, excludeId?: string): Promise<boolean> {
    return [...this.items.values()].some((item) => item.props.slug === slug && item.props.id !== excludeId);
  }

  async list(): Promise<NewsItem[]> {
    return [...this.items.values()].sort(
      (a, b) =>
        b.props.publishedAt.localeCompare(a.props.publishedAt) ||
        b.props.createdAt.getTime() - a.props.createdAt.getTime() ||
        b.props.id.localeCompare(a.props.id),
    );
  }

  async update(item: NewsItem): Promise<NewsItem> {
    if (!this.items.has(item.props.id)) {
      throw new NotFoundError("News item not found");
    }

    this.items.set(item.props.id, item);
    return item;
  }

  async delete(id: string): Promise<void> {
    if (!this.items.delete(id)) {
      throw new NotFoundError("News item not found");
    }
  }
}
