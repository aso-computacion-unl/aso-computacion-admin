import type { Event as PrismaEvent, Prisma } from "@prisma/client";

import { Event } from "@/domain/event";

// `@db.Date` columns come back as midnight UTC; the domain keeps the plain YYYY-MM-DD.
function toDateString(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

function toDbDate(value: string | null): Date | null {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

export function toDomain(record: PrismaEvent): Event {
  return Event.reconstitute({
    id: record.id,
    slug: record.slug,
    title: record.title,
    description: record.description,
    date: toDateString(record.date),
    type: record.type,
    commitMessage: record.commitMessage,
    hora: record.hora,
    lugar: record.lugar,
    para: record.para,
    featured: record.featured,
    linkUrl: record.linkUrl,
    linkLabel: record.linkLabel,
    highlights: record.highlights,
    isPublished: record.isPublished,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });
}

export function toPrismaCreate(event: Event): Prisma.EventUncheckedCreateInput {
  const { date, highlights, ...rest } = event.props;

  return { ...rest, date: toDbDate(date), highlights: [...highlights] };
}

/** Mutable columns only: id and createdAt never change after creation. */
export function toPrismaUpdate(event: Event): Prisma.EventUncheckedUpdateManyInput {
  const data: Partial<Prisma.EventUncheckedCreateInput> = toPrismaCreate(event);

  delete data.id;
  delete data.createdAt;

  return data;
}
