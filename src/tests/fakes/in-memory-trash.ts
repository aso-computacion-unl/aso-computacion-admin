import type { TrashedItem } from "@/application/ports/trashable-repository.port";

/**
 * The trash shelf shared by the in-memory repositories. Deletion times are a
 * deterministic clock (one second apart, in call order), so "newest first" does
 * not depend on how fast the test runs.
 */
export class InMemoryTrash<E extends { props: { id: string } }> {
  private readonly items = new Map<string, TrashedItem<E>>();
  private ticks = 0;

  put(entity: E): void {
    this.ticks += 1;
    this.items.set(entity.props.id, { entity, deletedAt: new Date(Date.UTC(2026, 0, 1, 0, 0, this.ticks)) });
  }

  get(id: string): TrashedItem<E> | null {
    return this.items.get(id) ?? null;
  }

  /** Removes and returns the trashed item, or null when it is not in the trash. */
  take(id: string): TrashedItem<E> | null {
    const item = this.get(id);

    this.items.delete(id);

    return item;
  }

  list(): TrashedItem<E>[] {
    return [...this.items.values()].sort((a, b) => b.deletedAt.getTime() - a.deletedAt.getTime());
  }
}
