import "server-only";
import { Prisma, type NewsItem as PrismaNewsItem } from "@/generated/prisma/client";

import { fetchPage, type ListCriteria, type Page, type PageRequest, type PublicationCounts } from "@/application/ports/list-criteria";
import type { NewsRepository } from "@/application/ports/news-repository.port";
import { NotFoundError } from "@/application/use-cases/use-case-error";
import { ValidationError } from "@/domain/domain-error";
import type { NewsItem } from "@/domain/news-item";

import { prisma } from "../prisma/client";
import { toDomain, toPrismaCreate, toPrismaUpdate } from "./news.mapper";
import { LIVE, publicationWhere, toPublicationCounts } from "./publication-filter";
import { PurgeableTrashPrismaRepository } from "./trashable-prisma.repository";

const SEARCH_FIELDS = ["title", "summary", "body"] as const;
// id breaks the last tie so the order is total and stable between reads and between pages.
const LIST_ORDER = [{ publishedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }] satisfies Prisma.NewsItemOrderByWithRelationInput[];

/** The slug check in the use case is advisory; the unique index is what actually decides a race. */
function rethrowSlugCollision(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    throw new ValidationError("slug", "slug is already used by another news item");
  }

  throw error;
}

export class NewsPrismaRepository
  extends PurgeableTrashPrismaRepository<NewsItem, PrismaNewsItem>
  implements NewsRepository
{
  protected readonly delegate = prisma.newsItem;
  protected readonly trashConfig = {
    notFound: "News item not found",
    toDomain,
    toUpdate: toPrismaUpdate,
    mapConflict: rethrowSlugCollision,
  };

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
    const records = await prisma.newsItem.findMany({ where: publicationWhere(criteria, SEARCH_FIELDS), orderBy: LIST_ORDER });

    return records.map(toDomain);
  }

  async listPage(criteria: ListCriteria, request: PageRequest): Promise<Page<NewsItem>> {
    const where = publicationWhere(criteria, SEARCH_FIELDS);

    return fetchPage(
      request,
      () => prisma.newsItem.count({ where }),
      async (take, skip) => (await prisma.newsItem.findMany({ where, orderBy: LIST_ORDER, take, skip })).map(toDomain),
    );
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
}
