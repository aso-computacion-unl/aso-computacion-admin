import type { Event } from "@/domain/event";

/** Persistence port for events. Implemented by the Prisma adapter and by in-memory fakes in tests. */
export interface EventRepository {
  create(event: Event): Promise<Event>;
  getById(id: string): Promise<Event | null>;
  /** True when another event (not `excludeId`) already uses the slug. */
  slugExists(slug: string, excludeId?: string): Promise<boolean>;
  /** Every event, drafts included: date descending (undated last), then newest first. */
  list(): Promise<Event[]>;
  update(event: Event): Promise<Event>;
  delete(id: string): Promise<void>;
}
