import type { ListCriteria, Page, PageableRepository, PageRequest, PublicationCounter, PublicationCounts } from "@/application/ports/list-criteria";
import type { OrderedContent, OrderedContentRepository } from "@/application/ports/ordered-content-repository.port";
import type { TrashedItem } from "@/application/ports/trashable-repository.port";
import { NotFoundError } from "@/application/use-cases/use-case-error";

import { matchesSearch, pageOf } from "./in-memory-page";
import { InMemoryTrash } from "./in-memory-trash";

/** Deterministic in-memory `OrderedContentRepository`; `list()` mirrors the Prisma ordering (sortOrder, createdAt, id). */
export class InMemoryOrderedRepository<E extends OrderedContent<E>>
  implements OrderedContentRepository<E>, PageableRepository<E>, PublicationCounter
{
  private readonly items = new Map<string, E>();
  private readonly trashed = new InMemoryTrash<E>();

  /** `searchTexts` names the text columns a search looks at; without it a search matches nothing. */
  constructor(private readonly searchTexts: (entity: E) => readonly (string | null | undefined)[] = () => []) {}

  async create(entity: E): Promise<E> {
    this.items.set(entity.props.id, entity);
    return entity;
  }

  async getById(id: string): Promise<E | null> {
    return this.items.get(id) ?? null;
  }

  async list(): Promise<E[]> {
    return [...this.items.values()].sort(
      (a, b) =>
        a.props.sortOrder - b.props.sortOrder ||
        a.props.createdAt.getTime() - b.props.createdAt.getTime() ||
        a.props.id.localeCompare(b.props.id),
    );
  }

  async countByStatus(): Promise<PublicationCounts> {
    const all = [...this.items.values()];
    const published = all.filter((entity) => entity.props.isPublished).length;

    return { published, draft: all.length - published };
  }

  async listPage(criteria: ListCriteria, request: PageRequest): Promise<Page<E>> {
    const matching = (await this.list()).filter((entity) => matchesSearch(criteria.search, this.searchTexts(entity)));

    return pageOf(matching, request);
  }

  async update(entity: E): Promise<E> {
    if (!this.items.has(entity.props.id)) {
      throw new NotFoundError("not found");
    }

    this.items.set(entity.props.id, entity);
    return entity;
  }

  async trash(id: string): Promise<void> {
    const entity = this.items.get(id);

    if (!entity) {
      throw new NotFoundError("not found");
    }

    this.items.delete(id);
    this.trashed.put(entity.withPublished(false));
  }

  async getTrashed(id: string): Promise<TrashedItem<E> | null> {
    return this.trashed.get(id);
  }

  async listTrashed(): Promise<TrashedItem<E>[]> {
    return this.trashed.list();
  }

  async restore(entity: E): Promise<E> {
    if (!this.trashed.take(entity.props.id)) {
      throw new NotFoundError("not found");
    }

    this.items.set(entity.props.id, entity);
    return entity;
  }

  async purge(id: string): Promise<void> {
    if (!this.trashed.take(id)) {
      throw new NotFoundError("not found");
    }
  }

  async saveOrder(orderedIds: readonly string[]): Promise<void> {
    orderedIds.forEach((id, index) => {
      const entity = this.items.get(id);

      if (entity) this.items.set(id, entity.withSortOrder(index));
    });
  }
}
