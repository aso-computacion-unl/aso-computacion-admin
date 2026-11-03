import type { TrashableRepository, TrashedItem } from "@/application/ports/trashable-repository.port";
import { NotFoundError } from "@/application/use-cases/use-case-error";

import { LIVE } from "./publication-filter";
import { toTrashedItem, TRASH_ORDER, TRASHED } from "./trash";

interface TrashWhere {
  id?: string;
  deletedAt?: null | { not: null };
}

/** The part of a Prisma model delegate the trash operations use; every content model has it. */
export interface TrashDelegate<Row extends { deletedAt: Date | null }> {
  updateMany(args: { where: TrashWhere; data: Record<string, unknown> }): Promise<{ count: number }>;
  findFirst(args: { where: TrashWhere }): Promise<Row | null>;
  findMany(args: { where: TrashWhere; orderBy: typeof TRASH_ORDER[number][] }): Promise<Row[]>;
  deleteMany(args: { where: TrashWhere }): Promise<{ count: number }>;
}

export interface TrashConfig<E, Row> {
  /** The `NotFoundError` message of the model, e.g. "Faq not found". */
  notFound: string;
  toDomain: (row: Row) => E;
  /** The mutable columns of an entity, as written by an update. */
  toUpdate: (entity: E) => Record<string, unknown>;
  /** Turns the database's unique-violation error into the domain error `create` would raise. */
  mapConflict?: (error: unknown, entity: E) => never;
}

/**
 * Trash, read-from-trash and restore for one Prisma model, written once. Each
 * repository extends this and only names its delegate and mappers, so every
 * content type moves to and from the trash in exactly the same way: a row is
 * trashed only while live, and read, restored or purged only while trashed.
 */
export abstract class TrashablePrismaRepository<E extends { props: { id: string } }, Row extends { deletedAt: Date | null }>
  implements TrashableRepository<E>
{
  protected abstract readonly delegate: TrashDelegate<Row>;
  protected abstract readonly trashConfig: TrashConfig<E, Row>;

  async trash(id: string): Promise<void> {
    const { count } = await this.delegate.updateMany({
      where: { id, ...LIVE },
      data: { deletedAt: new Date(), isPublished: false },
    });

    if (count === 0) {
      throw new NotFoundError(this.trashConfig.notFound);
    }
  }

  async getTrashed(id: string): Promise<TrashedItem<E> | null> {
    const row = await this.delegate.findFirst({ where: { id, ...TRASHED } });

    return row ? toTrashedItem(this.trashConfig.toDomain(row), row.deletedAt) : null;
  }

  async listTrashed(): Promise<TrashedItem<E>[]> {
    const rows = await this.delegate.findMany({ where: TRASHED, orderBy: [...TRASH_ORDER] });

    return rows.map((row) => toTrashedItem(this.trashConfig.toDomain(row), row.deletedAt));
  }

  async restore(entity: E): Promise<E> {
    const { toUpdate, mapConflict, notFound } = this.trashConfig;
    let count: number;

    try {
      ({ count } = await this.delegate.updateMany({
        where: { id: entity.props.id, ...TRASHED },
        data: { ...toUpdate(entity), deletedAt: null },
      }));
    } catch (error) {
      return mapConflict ? mapConflict(error, entity) : Promise.reject(error);
    }

    if (count === 0) {
      throw new NotFoundError(notFound);
    }

    return entity;
  }
}

/** For the models whose purge only removes the row (an event's also reports its photos). */
export abstract class PurgeableTrashPrismaRepository<
  E extends { props: { id: string } },
  Row extends { deletedAt: Date | null },
> extends TrashablePrismaRepository<E, Row> {
  async purge(id: string): Promise<void> {
    const { count } = await this.delegate.deleteMany({ where: { id, ...TRASHED } });

    if (count === 0) {
      throw new NotFoundError(this.trashConfig.notFound);
    }
  }
}
