import type { EventPhoto } from "@/domain/event-photo";

export interface EventPhotoRepository {
  getById(id: string): Promise<EventPhoto | null>;
  /** Active photos of one event in gallery order (sortOrder, then oldest first). */
  listActiveByEventId(eventId: string): Promise<EventPhoto[]>;
  countActiveByEventIds(eventIds: readonly string[]): Promise<ReadonlyMap<string, number>>;
  /**
   * Persists a photo at the end of the event's active gallery, only while the
   * event has fewer than `maxActive` active photos. The count and the position
   * are computed atomically, so concurrent uploads neither squeeze past the
   * cap nor share a position; the photo's own `sortOrder` is ignored and the
   * returned photo carries the assigned one. Throws `NotFoundError` when the
   * event is gone and `ValidationError("photos")` at the cap.
   */
  add(photo: EventPhoto, maxActive: number): Promise<EventPhoto>;
  update(photo: EventPhoto): Promise<EventPhoto>;
  /** Rewrites sortOrder of the given photos to their index in the list. */
  saveOrder(eventId: string, orderedPhotoIds: readonly string[]): Promise<void>;
}
