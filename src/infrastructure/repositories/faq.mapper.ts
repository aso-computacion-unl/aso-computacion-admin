import type { Faq as PrismaFaq, Prisma } from "@prisma/client";

import { Faq } from "@/domain/faq";

export function toDomain(record: PrismaFaq): Faq {
  return Faq.reconstitute({
    id: record.id,
    question: record.question,
    answer: record.answer,
    sortOrder: record.sortOrder,
    isPublished: record.isPublished,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });
}

export function toPrismaCreate(faq: Faq): Prisma.FaqUncheckedCreateInput {
  return { ...faq.props };
}

/** Mutable columns only: id and createdAt never change after creation. */
export function toPrismaUpdate(faq: Faq): Prisma.FaqUncheckedUpdateManyInput {
  const data: Partial<Prisma.FaqUncheckedCreateInput> = toPrismaCreate(faq);

  delete data.id;
  delete data.createdAt;

  return data;
}
