import type { EventPhotoRepository } from "@/application/ports/event-photo-repository.port";
import { NotFoundError } from "@/application/use-cases/use-case-error";
import { ValidationError } from "@/domain/domain-error";
import type { EventPhoto } from "@/domain/event-photo";

export class InMemoryEventPhotoRepository implements EventPhotoRepository {
  /** When set, the next `add` rejects with it (simulates a failed DB write). */
  addError: Error | undefined;

  private readonly photos = new Map<string, EventPhoto>();

  async getById(id: string): Promise<EventPhoto | null> {
    return this.photos.get(id) ?? null;
  }

  async listActiveByEventId(eventId: string): Promise<EventPhoto[]> {
    return [...this.photos.values()]
      .filter((photo) => photo.props.eventId === eventId && photo.props.isActive)
      .sort((a, b) => a.props.sortOrder - b.props.sortOrder || a.props.createdAt.getTime() - b.props.createdAt.getTime());
  }

  async countActiveByEventIds(eventIds: readonly string[]): Promise<ReadonlyMap<string, number>> {
    const counts = new Map<string, number>();

    for (const photo of this.photos.values()) {
      if (photo.props.isActive && eventIds.includes(photo.props.eventId)) {
        counts.set(photo.props.eventId, (counts.get(photo.props.eventId) ?? 0) + 1);
      }
    }

    return counts;
  }

  /** Mirrors the cascade of deleting an event: removes every photo row of it and returns their storage ids. */
  removeAllOfEvent(eventId: string): string[] {
    const removed = [...this.photos.values()].filter((photo) => photo.props.eventId === eventId);

    for (const photo of removed) {
      this.photos.delete(photo.props.id);
    }

    return removed.map((photo) => photo.props.publicId);
  }

  async add(photo: EventPhoto, maxActive: number): Promise<EventPhoto> {
    if (this.addError) {
      throw this.addError;
    }

    const active = await this.listActiveByEventId(photo.props.eventId);

    if (active.length >= maxActive) {
      throw new ValidationError("photos", `An event can have at most ${maxActive} active photos`);
    }

    const sortOrder = active.reduce((next, current) => Math.max(next, current.props.sortOrder + 1), 0);
    const placed = photo.withSortOrder(sortOrder);
    this.photos.set(placed.props.id, placed);
    return placed;
  }

  async update(photo: EventPhoto): Promise<EventPhoto> {
    if (!this.photos.has(photo.props.id)) {
      throw new NotFoundError("Event photo not found");
    }

    this.photos.set(photo.props.id, photo);
    return photo;
  }

  async saveOrder(eventId: string, orderedPhotoIds: readonly string[]): Promise<void> {
    orderedPhotoIds.forEach((id, index) => {
      const photo = this.photos.get(id);

      if (photo && photo.props.eventId === eventId) {
        this.photos.set(id, photo.withSortOrder(index));
      }
    });
  }
}
