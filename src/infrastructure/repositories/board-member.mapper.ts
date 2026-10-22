import type { BoardMember as PrismaBoardMember, Prisma } from "@prisma/client";

import { BoardMember } from "@/domain/board-member";

export function toDomain(record: PrismaBoardMember): BoardMember {
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

  return BoardMember.reconstitute({
    id: record.id,
    name: record.name,
    role: record.role,
    photo,
    sortOrder: record.sortOrder,
    isPublished: record.isPublished,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });
}

export function toPrismaCreate({ props }: BoardMember): Prisma.BoardMemberUncheckedCreateInput {
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
export function toPrismaUpdate(member: BoardMember): Prisma.BoardMemberUncheckedUpdateManyInput {
  const data: Partial<Prisma.BoardMemberUncheckedCreateInput> = toPrismaCreate(member);

  delete data.id;
  delete data.createdAt;

  return data;
}
