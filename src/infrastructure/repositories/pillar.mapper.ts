import type { Pillar as PrismaPillar, Prisma } from "@prisma/client";

import { Pillar } from "@/domain/pillar";

export function toDomain(record: PrismaPillar): Pillar {
  // The CHECK constraint guarantees the image columns are all set or all null.
  const image =
    record.imageUrl !== null &&
    record.imagePublicId !== null &&
    record.imageWidth !== null &&
    record.imageHeight !== null &&
    record.imageAlt !== null
      ? {
          url: record.imageUrl,
          publicId: record.imagePublicId,
          width: record.imageWidth,
          height: record.imageHeight,
          alt: record.imageAlt,
        }
      : null;

  return Pillar.reconstitute({
    id: record.id,
    word: record.word,
    title: record.title,
    text: record.text,
    image,
    sortOrder: record.sortOrder,
    isPublished: record.isPublished,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });
}

export function toPrismaCreate({ props }: Pillar): Prisma.PillarUncheckedCreateInput {
  const { image, ...rest } = props;

  return {
    ...rest,
    imageUrl: image?.url ?? null,
    imagePublicId: image?.publicId ?? null,
    imageWidth: image?.width ?? null,
    imageHeight: image?.height ?? null,
    imageAlt: image?.alt ?? null,
  };
}

/** Mutable columns only: id and createdAt never change after creation. */
export function toPrismaUpdate(pillar: Pillar): Prisma.PillarUncheckedUpdateManyInput {
  const data: Partial<Prisma.PillarUncheckedCreateInput> = toPrismaCreate(pillar);

  delete data.id;
  delete data.createdAt;

  return data;
}
