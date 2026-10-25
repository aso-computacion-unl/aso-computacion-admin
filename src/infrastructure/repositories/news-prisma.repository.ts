import "server-only";
import { Prisma } from "@prisma/client";

import type { ListCriteria, PublicationCounts } from "@/application/ports/list-criteria";
import type { NewsRepository } from "@/application/ports/news-repository.port";
import { NotFoundError } from "@/application/use-cases/use-case-error";
import { ValidationError } from "@/domain/domain-error";
import type { NewsItem } from "@/domain/news-item";

import { prisma } from "../prisma/client";
import { toDomain, toPrismaCreate, toPrismaUpdate } from "./news.mapper";
import { publicationWhere, toPublicationCounts } from "./publication-filter";

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
    const record = await prisma.newsItem.findUnique({ where: { id } });

    return record ? toDomain(record) : null;
  }

  async slugExists(slug: string, excludeId?: string): Promise<boolean> {
    const record = await prisma.newsItem.findFirst({
      where: { slug, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    });

    return record !== null;
  }

  async countByStatus(): Promise<PublicationCounts> {
    // Typed on its own: as an argument, Prisma infers its generic error type from the parameter instead.
    const groups = await prisma.newsItem.groupBy({ by: ["isPublished"], _count: { _all: true } });

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
        where: { id: item.props.id },
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

  async delete(id: string): Promise<void> {
    const { count } = await prisma.newsItem.deleteMany({ where: { id } });

    if (count === 0) {
      throw new NotFoundError("News item not found");
    }
  }
}
