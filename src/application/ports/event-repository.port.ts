import type { Event } from "@/domain/event";

import type { ListCriteria, PublicationCounter } from "./list-criteria";
import type { TrashableRepository } from "./trashable-repository.port";

/** Persistence port for events. Implemented by the Prisma adapter and by in-memory fakes in tests. */
export interface EventRepository extends PublicationCounter, TrashableRepository<Event> {
  create(event: Event): Promise<Event>;
  getById(id: string): Promise<Event | null>;
  /** True when another event (not `excludeId`) already uses the slug. */
  slugExists(slug: string, excludeId?: string): Promise<boolean>;
  /** Every event, drafts included unless `criteria` narrows it: date descending (undated last), then newest first. */
  list(criteria?: ListCriteria): Promise<Event[]>;
  update(event: Event): Promise<Event>;
  /**
   * Deletes the event and, by cascade, its photo rows, and returns the storage
   * ids of every photo row removed with it, active or not. The ids are read in
   * the same transaction as the delete, under a lock on the event row, so a
   * photo attached concurrently is either reported here or never stored (its
   * attach fails with `NotFoundError`). Throws `NotFoundError` for an unknown event.
   */
  delete(id: string): Promise<string[]>;
  /**
   * Same as `delete`, but only for a TRASHED event: throws `NotFoundError` for
   * a live or unknown one. Photos stay attached to a trashed event, so this is
   * the one place they are removed with it.
   */
  purge(id: string): Promise<string[]>;
}
