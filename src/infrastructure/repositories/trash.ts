import type { TrashedItem } from "@/application/ports/trashable-repository.port";

/** Prisma `where` for rows in the trash. */
export const TRASHED = { deletedAt: { not: null } } as const;

/** Newest deletion first; the id makes ties stable. */
export const TRASH_ORDER = [{ deletedAt: "desc" }, { id: "asc" }] as const;

/** Pairs a domain entity with its deletion time; a row read through `TRASHED` always has one. */
export function toTrashedItem<E>(entity: E, deletedAt: Date | null): TrashedItem<E> {
  if (!deletedAt) {
    throw new Error("Row is not in the trash");
  }

  return { entity, deletedAt };
}
