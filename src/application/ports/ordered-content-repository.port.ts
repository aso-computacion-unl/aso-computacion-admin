/**
 * What the generic admin list use cases need from an entity: an id, a display
 * position, a publish flag, and copies that change only those.
 */
export interface OrderedContent<E> {
  readonly props: {
    readonly id: string;
    readonly sortOrder: number;
    readonly isPublished: boolean;
    readonly createdAt: Date;
  };
  withPublished(isPublished: boolean): E;
  withSortOrder(sortOrder: number): E;
}

import type { TrashableRepository } from "./trashable-repository.port";

/**
 * Persistence port shared by every admin-ordered list (FAQ, pillars, social
 * links, board). Implemented by the Prisma adapters and by an in-memory fake.
 */
export interface OrderedContentRepository<E extends OrderedContent<E>> extends TrashableRepository<E> {
  create(entity: E): Promise<E>;
  getById(id: string): Promise<E | null>;
  /** Every live item, drafts included, in display order: sortOrder, then oldest first, then id. */
  list(): Promise<E[]>;
  update(entity: E): Promise<E>;
  delete(id: string): Promise<void>;
  /** Removes a TRASHED row for good. Throws `NotFoundError` unless the row is in the trash. */
  purge(id: string): Promise<void>;
  /** Rewrites sortOrder of the given ids to their index in the list, atomically. */
  saveOrder(orderedIds: readonly string[]): Promise<void>;
}
