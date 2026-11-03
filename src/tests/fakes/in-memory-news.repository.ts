import type { ListCriteria, PublicationCounts } from "@/application/ports/list-criteria";
import type { NewsRepository } from "@/application/ports/news-repository.port";
import { NotFoundError } from "@/application/use-cases/use-case-error";
import type { TrashedItem } from "@/application/ports/trashable-repository.port";
import { ValidationError } from "@/domain/domain-error";
import type { NewsItem } from "@/domain/news-item";

import { InMemoryTrash } from "./in-memory-trash";

/** Deterministic in-memory `NewsRepository`; `list()` mirrors the Prisma ordering (publishedAt desc, then newest created). */
export class InMemoryNewsRepository implements NewsRepository {
  private readonly items = new Map<string, NewsItem>();
  private readonly trashed = new InMemoryTrash<NewsItem>();

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

  async countByStatus(): Promise<PublicationCounts> {
    const all = [...this.items.values()];
    const published = all.filter((item) => item.props.isPublished).length;

    return { published, draft: all.length - published };
  }

  async list(criteria: ListCriteria = {}): Promise<NewsItem[]> {
    return [...this.items.values()]
      .filter((item) => criteria.status === undefined || item.props.isPublished === (criteria.status === "published"))
      .sort(
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

  async trash(id: string): Promise<void> {
    const item = this.items.get(id);

    if (!item) {
      throw new NotFoundError("News item not found");
    }

    this.items.delete(id);
    this.trashed.put(item.withPublished(false));
  }

  async getTrashed(id: string): Promise<TrashedItem<NewsItem> | null> {
    return this.trashed.get(id);
  }

  async listTrashed(): Promise<TrashedItem<NewsItem>[]> {
    return this.trashed.list();
  }

  /** Like the partial unique index: restoring over a live item with the same slug is refused and stores nothing. */
  async restore(item: NewsItem): Promise<NewsItem> {
    if (!this.trashed.get(item.props.id)) {
      throw new NotFoundError("News item not found");
    }

    if (await this.slugExists(item.props.slug, item.props.id)) {
      throw new ValidationError("slug", "slug is already used by another news item");
    }

    this.trashed.take(item.props.id);
    this.items.set(item.props.id, item);
    return item;
  }

  async purge(id: string): Promise<void> {
    if (!this.trashed.take(id)) {
      throw new NotFoundError("News item not found");
    }
  }
}
