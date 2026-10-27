import type { ImpactStat as PrismaImpactStat, Prisma } from "@prisma/client";

import { ImpactStat } from "@/domain/impact-stat";

export function toDomain(record: PrismaImpactStat): ImpactStat {
  return ImpactStat.reconstitute({
    id: record.id,
    value: record.value,
    label: record.label,
    sortOrder: record.sortOrder,
    isPublished: record.isPublished,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });
}

export function toPrismaCreate(stat: ImpactStat): Prisma.ImpactStatUncheckedCreateInput {
  return { ...stat.props };
}

/** Mutable columns only: id and createdAt never change after creation. */
export function toPrismaUpdate(stat: ImpactStat): Prisma.ImpactStatUncheckedUpdateManyInput {
  const data: Partial<Prisma.ImpactStatUncheckedCreateInput> = toPrismaCreate(stat);

  delete data.id;
  delete data.createdAt;

  return data;
}
