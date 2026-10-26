import type { OrderedContent, OrderedContentRepository } from "@/application/ports/ordered-content-repository.port";
import type { TrashedItem } from "@/application/ports/trashable-repository.port";
import { NotFoundError } from "@/application/use-cases/use-case-error";

import { InMemoryTrash } from "./in-memory-trash";

/** Deterministic in-memory `OrderedContentRepository`; `list()` mirrors the Prisma ordering (sortOrder, createdAt, id). */
export class InMemoryOrderedRepository<E extends OrderedContent<E>>
  implements OrderedContentRepository<E>
{
  private readonly items = new Map<string, E>();
  private readonly trashed = new InMemoryTrash<E>();

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
