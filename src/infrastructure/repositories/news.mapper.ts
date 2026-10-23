import type { NewsItem as PrismaNewsItem, Prisma } from "@prisma/client";

import { NewsItem } from "@/domain/news-item";

// `@db.Date` columns come back as midnight UTC; the domain keeps the plain YYYY-MM-DD.
function toDateString(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function toDomain(record: PrismaNewsItem): NewsItem {
  // The CHECK constraint guarantees the cover columns are all set or all null.
  const cover =
    record.coverUrl !== null &&
    record.coverPublicId !== null &&
    record.coverWidth !== null &&
    record.coverHeight !== null &&
    record.coverAlt !== null
      ? {
          url: record.coverUrl,
          publicId: record.coverPublicId,
          width: record.coverWidth,
          height: record.coverHeight,
          alt: record.coverAlt,
        }
      : null;

  return NewsItem.reconstitute({
    id: record.id,
    slug: record.slug,
    title: record.title,
    summary: record.summary,
    body: record.body,
    publishedAt: toDateString(record.publishedAt),
    cover,
    isPublished: record.isPublished,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });
}

export function toPrismaCreate({ props }: NewsItem): Prisma.NewsItemUncheckedCreateInput {
  const { cover, publishedAt, ...rest } = props;

  return {
    ...rest,
    publishedAt: new Date(`${publishedAt}T00:00:00.000Z`),
    coverUrl: cover?.url ?? null,
    coverPublicId: cover?.publicId ?? null,
    coverWidth: cover?.width ?? null,
    coverHeight: cover?.height ?? null,
    coverAlt: cover?.alt ?? null,
  };
}

/** Mutable columns only: id and createdAt never change after creation. */
export function toPrismaUpdate(item: NewsItem): Prisma.NewsItemUncheckedUpdateManyInput {
  const data: Partial<Prisma.NewsItemUncheckedCreateInput> = toPrismaCreate(item);

  delete data.id;
  delete data.createdAt;

  return data;
}
