import type { Sponsor as PrismaSponsor, Prisma } from "@prisma/client";

import { Sponsor } from "@/domain/sponsor";

export function toDomain(record: PrismaSponsor): Sponsor {
  // The CHECK constraint guarantees the logo columns are all set or all null.
  const logo =
    record.logoUrl !== null &&
    record.logoPublicId !== null &&
    record.logoWidth !== null &&
    record.logoHeight !== null &&
    record.logoAlt !== null
      ? {
          url: record.logoUrl,
          publicId: record.logoPublicId,
          width: record.logoWidth,
          height: record.logoHeight,
          alt: record.logoAlt,
        }
      : null;

  return Sponsor.reconstitute({
    id: record.id,
    name: record.name,
    logo,
    url: record.url,
    sortOrder: record.sortOrder,
    isPublished: record.isPublished,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });
}

export function toPrismaCreate({ props }: Sponsor): Prisma.SponsorUncheckedCreateInput {
  const { logo, ...rest } = props;

  return {
    ...rest,
    logoUrl: logo?.url ?? null,
    logoPublicId: logo?.publicId ?? null,
    logoWidth: logo?.width ?? null,
    logoHeight: logo?.height ?? null,
    logoAlt: logo?.alt ?? null,
  };
}

/** Mutable columns only: id and createdAt never change after creation. */
export function toPrismaUpdate(sponsor: Sponsor): Prisma.SponsorUncheckedUpdateManyInput {
  const data: Partial<Prisma.SponsorUncheckedCreateInput> = toPrismaCreate(sponsor);

  delete data.id;
  delete data.createdAt;

  return data;
}
