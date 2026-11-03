import type { Testimonial as PrismaTestimonial, Prisma } from "@prisma/client";

import { Testimonial } from "@/domain/testimonial";

export function toDomain(record: PrismaTestimonial): Testimonial {
  // The CHECK constraint guarantees the photo columns are all set or all null.
  const photo =
    record.photoUrl !== null &&
    record.photoPublicId !== null &&
    record.photoWidth !== null &&
    record.photoHeight !== null &&
    record.photoAlt !== null
      ? {
          url: record.photoUrl,
          publicId: record.photoPublicId,
          width: record.photoWidth,
          height: record.photoHeight,
          alt: record.photoAlt,
        }
      : null;

  return Testimonial.reconstitute({
    id: record.id,
    quote: record.quote,
    name: record.name,
    role: record.role,
    photo,
    sortOrder: record.sortOrder,
    isPublished: record.isPublished,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });
}

export function toPrismaCreate({ props }: Testimonial): Prisma.TestimonialUncheckedCreateInput {
  const { photo, ...rest } = props;

  return {
    ...rest,
    photoUrl: photo?.url ?? null,
    photoPublicId: photo?.publicId ?? null,
    photoWidth: photo?.width ?? null,
    photoHeight: photo?.height ?? null,
    photoAlt: photo?.alt ?? null,
  };
}

/** Mutable columns only: id and createdAt never change after creation. */
export function toPrismaUpdate(testimonial: Testimonial): Prisma.TestimonialUncheckedUpdateManyInput {
  const data: Partial<Prisma.TestimonialUncheckedCreateInput> = toPrismaCreate(testimonial);

  delete data.id;
  delete data.createdAt;

  return data;
}
