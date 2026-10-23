import type { SocialLink as PrismaSocialLink, Prisma } from "@prisma/client";

import { SocialLink, type SocialPlatform } from "@/domain/social-link";

export function toDomain(record: PrismaSocialLink): SocialLink {
  return SocialLink.reconstitute({
    id: record.id,
    // The column is text; only validated platforms are ever written.
    platform: record.platform as SocialPlatform,
    label: record.label,
    handle: record.handle,
    url: record.url,
    note: record.note,
    blurb: record.blurb,
    sortOrder: record.sortOrder,
    isPublished: record.isPublished,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });
}

export function toPrismaCreate(link: SocialLink): Prisma.SocialLinkUncheckedCreateInput {
  return { ...link.props };
}

/** Mutable columns only: id and createdAt never change after creation. */
export function toPrismaUpdate(link: SocialLink): Prisma.SocialLinkUncheckedUpdateManyInput {
  const data: Partial<Prisma.SocialLinkUncheckedCreateInput> = toPrismaCreate(link);

  delete data.id;
  delete data.createdAt;

  return data;
}
