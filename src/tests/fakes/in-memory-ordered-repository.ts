import type { OrderedContent, OrderedContentRepository } from "@/application/ports/ordered-content-repository.port";
import { NotFoundError } from "@/application/use-cases/use-case-error";

/** Deterministic in-memory `OrderedContentRepository`; `list()` mirrors the Prisma ordering (sortOrder, createdAt, id). */
export class InMemoryOrderedRepository<E extends OrderedContent<E>>
  implements OrderedContentRepository<E>
{
  private readonly items = new Map<string, E>();

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

  async delete(id: string): Promise<void> {
    if (!this.items.delete(id)) {
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
