import "server-only";
import { Prisma } from "@prisma/client";

import type { ListCriteria, PublicationCounts } from "@/application/ports/list-criteria";
import type { NewsRepository } from "@/application/ports/news-repository.port";
import { NotFoundError } from "@/application/use-cases/use-case-error";
import { ValidationError } from "@/domain/domain-error";
import type { TrashedItem } from "@/application/ports/trashable-repository.port";
import type { NewsItem } from "@/domain/news-item";

import { prisma } from "../prisma/client";
import { toDomain, toPrismaCreate, toPrismaUpdate } from "./news.mapper";
import { LIVE, publicationWhere, toPublicationCounts } from "./publication-filter";
import { toTrashedItem, TRASH_ORDER, TRASHED } from "./trash";

/** The slug check in the use case is advisory; the unique index is what actually decides a race. */
function rethrowSlugCollision(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    throw new ValidationError("slug", "slug is already used by another news item");
  }

  throw error;
}

export class NewsPrismaRepository implements NewsRepository {
  async create(item: NewsItem): Promise<NewsItem> {
    try {
      return toDomain(await prisma.newsItem.create({ data: toPrismaCreate(item) }));
    } catch (error) {
      return rethrowSlugCollision(error);
    }
  }

  async getById(id: string): Promise<NewsItem | null> {
    const record = await prisma.newsItem.findUnique({ where: { id, ...LIVE } });

    return record ? toDomain(record) : null;
  }

  async slugExists(slug: string, excludeId?: string): Promise<boolean> {
    const record = await prisma.newsItem.findFirst({
      where: { slug, ...LIVE, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    });

    return record !== null;
  }

  async countByStatus(): Promise<PublicationCounts> {
    // Typed on its own: as an argument, Prisma infers its generic error type from the parameter instead.
    const groups = await prisma.newsItem.groupBy({ by: ["isPublished"], where: LIVE, _count: { _all: true } });

    return toPublicationCounts(groups);
  }

  async list(criteria?: ListCriteria): Promise<NewsItem[]> {
    // id breaks the last tie so the order is stable between reads.
    const records = await prisma.newsItem.findMany({
      where: publicationWhere(criteria),
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    });

    return records.map(toDomain);
  }

  async update(item: NewsItem): Promise<NewsItem> {
    try {
      const [record] = await prisma.newsItem.updateManyAndReturn({
        where: { id: item.props.id, ...LIVE },
        data: toPrismaUpdate(item),
      });

      if (!record) {
        throw new NotFoundError("News item not found");
      }

      return toDomain(record);
    } catch (error) {
      return error instanceof NotFoundError ? Promise.reject(error) : rethrowSlugCollision(error);
    }
  }

  async trash(id: string): Promise<void> {
    const { count } = await prisma.newsItem.updateMany({
      where: { id, ...LIVE },
      data: { deletedAt: new Date(), isPublished: false },
    });

    if (count === 0) {
      throw new NotFoundError("News item not found");
    }
  }

  async getTrashed(id: string): Promise<TrashedItem<NewsItem> | null> {
    const record = await prisma.newsItem.findFirst({ where: { id, ...TRASHED } });

    return record ? toTrashedItem(toDomain(record), record.deletedAt) : null;
  }

  async listTrashed(): Promise<TrashedItem<NewsItem>[]> {
    const records = await prisma.newsItem.findMany({ where: TRASHED, orderBy: [...TRASH_ORDER] });

    return records.map((record) => toTrashedItem(toDomain(record), record.deletedAt));
  }

  async restore(item: NewsItem): Promise<NewsItem> {
    try {
      const [record] = await prisma.newsItem.updateManyAndReturn({
        where: { id: item.props.id, ...TRASHED },
        data: { ...toPrismaUpdate(item), deletedAt: null },
      });

      if (!record) {
        throw new NotFoundError("News item not found");
      }

      return toDomain(record);
    } catch (error) {
      return error instanceof NotFoundError ? Promise.reject(error) : rethrowSlugCollision(error);
    }
  }

  async purge(id: string): Promise<void> {
    const { count } = await prisma.newsItem.deleteMany({ where: { id, ...TRASHED } });

    if (count === 0) {
      throw new NotFoundError("News item not found");
    }
  }

  async delete(id: string): Promise<void> {
    const { count } = await prisma.newsItem.deleteMany({ where: { id } });

    if (count === 0) {
      throw new NotFoundError("News item not found");
    }
  }
}
