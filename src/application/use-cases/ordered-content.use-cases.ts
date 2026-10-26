import type { OrderedContent, OrderedContentRepository } from "../ports/ordered-content-repository.port";
import { NotFoundError } from "./use-case-error";

// The admin lists (FAQ, pillars, social links, board) share list, get, publish
// and move (trash, restore and purge live in their own modules); only create/update differ, so those stay per entity. Each
// class takes the "not found" message so the interface layer can say what is missing.

/** Position for a new item: after everything that exists. */
export function nextSortOrder(items: readonly OrderedContent<unknown>[]): number {
  return items.reduce((next, item) => Math.max(next, item.props.sortOrder + 1), 0);
}

/** Admin listing: every item, drafts included, in display order. */
export class ListOrderedContentUseCase<E extends OrderedContent<E>, R> {
  constructor(
    private readonly repository: OrderedContentRepository<E>,
    private readonly toResult: (entity: E) => R,
  ) {}

  async execute(): Promise<R[]> {
    return (await this.repository.list()).map(this.toResult);
  }
}

export class GetOrderedContentUseCase<E extends OrderedContent<E>, R> {
  constructor(
    private readonly repository: OrderedContentRepository<E>,
    private readonly toResult: (entity: E) => R,
    private readonly notFoundMessage: string,
  ) {}

  async execute({ id }: { id: string }): Promise<R> {
    const entity = await this.repository.getById(id);

    if (!entity) {
      throw new NotFoundError(this.notFoundMessage);
    }

    return this.toResult(entity);
  }
}

/** Publish and unpublish are the same transition; only the flag differs. */
export class SetOrderedContentPublishedUseCase<E extends OrderedContent<E>, R> {
  constructor(
    private readonly repository: OrderedContentRepository<E>,
    private readonly toResult: (entity: E) => R,
    private readonly notFoundMessage: string,
  ) {}

  async execute({ id, isPublished }: { id: string; isPublished: boolean }): Promise<R> {
    const entity = await this.repository.getById(id);

    if (!entity) {
      throw new NotFoundError(this.notFoundMessage);
    }

    return this.toResult(await this.repository.update(entity.withPublished(isPublished)));
  }
}

/** Moves one item a single step and renumbers the list 0..n-1, so items that share a position still move. */
export class MoveOrderedContentUseCase<E extends OrderedContent<E>> {
  constructor(
    private readonly repository: OrderedContentRepository<E>,
    private readonly notFoundMessage: string,
  ) {}

  async execute({ id, direction }: { id: string; direction: "up" | "down" }): Promise<void> {
    const ids = (await this.repository.list()).map((entity) => entity.props.id);
    const index = ids.indexOf(id);

    if (index === -1) {
      throw new NotFoundError(this.notFoundMessage);
    }

    const target = direction === "up" ? index - 1 : index + 1;
    const neighbour = ids[target];

    if (neighbour !== undefined) {
      ids[target] = id;
      ids[index] = neighbour;
    }

    await this.repository.saveOrder(ids);
  }
}
