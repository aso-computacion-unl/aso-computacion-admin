/** A row in the trash and when it was moved there. */
export interface TrashedItem<E> {
  readonly entity: E;
  readonly deletedAt: Date;
}

/**
 * Trash operations of a content repository. A trashed row is invisible to
 * every other method of the repository (reads, lists, counts, uniqueness
 * checks, reordering) until it is restored.
 */
export interface TrashableRepository<E> {
  /** Moves a live row to the trash and unpublishes it. Throws `NotFoundError` unless the row is live. */
  trash(id: string): Promise<void>;
  /** The trashed row, or null when the id is unknown or the row is live. */
  getTrashed(id: string): Promise<TrashedItem<E> | null>;
  /** Every trashed row, most recently deleted first. */
  listTrashed(): Promise<TrashedItem<E>[]>;
  /**
   * Stores `entity` (the state it comes back with) over the trashed row and
   * makes it live again, atomically. Throws `NotFoundError` unless the row is
   * trashed, and the same collision errors as `create` when a live row now uses
   * its slug or command; nothing is stored in either case.
   */
  restore(entity: E): Promise<E>;
}
