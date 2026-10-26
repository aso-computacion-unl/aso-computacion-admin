import type { EventRepository } from "@/application/ports/event-repository.port";
import type { ListCriteria, PublicationCounts } from "@/application/ports/list-criteria";
import { NotFoundError } from "@/application/use-cases/use-case-error";
import type { Event } from "@/domain/event";

import type { InMemoryEventPhotoRepository } from "./in-memory-event-photo.repository";

/** Deterministic in-memory `EventRepository`; `list()` mirrors the Prisma ordering (date desc, nulls last, then newest). */
export class InMemoryEventRepository implements EventRepository {
  private readonly events = new Map<string, Event>();

  /** Pass the photo fake to mirror the cascade: deleting an event removes its photos and returns their storage ids. */
  constructor(private readonly photos?: InMemoryEventPhotoRepository) {}

  async create(event: Event): Promise<Event> {
    this.events.set(event.props.id, event);
    return event;
  }

  async getById(id: string): Promise<Event | null> {
    return this.events.get(id) ?? null;
  }

  async slugExists(slug: string, excludeId?: string): Promise<boolean> {
    return [...this.events.values()].some((event) => event.props.slug === slug && event.props.id !== excludeId);
  }

  async countByStatus(): Promise<PublicationCounts> {
    const all = [...this.events.values()];
    const published = all.filter((event) => event.props.isPublished).length;

    return { published, draft: all.length - published };
  }

  async list(criteria: ListCriteria = {}): Promise<Event[]> {
    return [...this.events.values()]
      .filter((event) => criteria.status === undefined || event.props.isPublished === (criteria.status === "published"))
      .sort((a, b) => {
        if (a.props.date !== b.props.date) {
          if (a.props.date === null) return 1;
          if (b.props.date === null) return -1;
          return a.props.date < b.props.date ? 1 : -1;
        }
        return b.props.createdAt.getTime() - a.props.createdAt.getTime();
      });
  }

  async update(event: Event): Promise<Event> {
    if (!this.events.has(event.props.id)) {
      throw new NotFoundError("Event not found");
    }

    this.events.set(event.props.id, event);
    return event;
  }

  async delete(id: string): Promise<string[]> {
    if (!this.events.delete(id)) {
      throw new NotFoundError("Event not found");
    }

    return this.photos?.removeAllOfEvent(id) ?? [];
  }
}
