import type { EventPhoto } from "@/domain/event-photo";

export interface EventPhotoRepository {
  getById(id: string): Promise<EventPhoto | null>;
  /** Active photos of one event in gallery order (sortOrder, then oldest first). */
  listActiveByEventId(eventId: string): Promise<EventPhoto[]>;
  countActiveByEventIds(eventIds: readonly string[]): Promise<ReadonlyMap<string, number>>;
  /**
   * Persists a photo only while the event has fewer than `maxActive` active
   * photos. The count is re-checked atomically, so two concurrent uploads
   * cannot both squeeze under the cap. Throws `NotFoundError` when the event
   * is gone and `ValidationError("photos")` at the cap.
   */
  add(photo: EventPhoto, maxActive: number): Promise<EventPhoto>;
  update(photo: EventPhoto): Promise<EventPhoto>;
  /** Rewrites sortOrder of the given photos to their index in the list. */
  saveOrder(eventId: string, orderedPhotoIds: readonly string[]): Promise<void>;
}
