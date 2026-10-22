import type { EventPhoto as PrismaEventPhoto } from "@prisma/client";

import { EventPhoto } from "@/domain/event-photo";

export function toDomain(record: PrismaEventPhoto): EventPhoto {
  return EventPhoto.reconstitute({
    id: record.id,
    eventId: record.eventId,
    url: record.url,
    publicId: record.publicId,
    width: record.width,
    height: record.height,
    alt: record.alt,
    sortOrder: record.sortOrder,
    isActive: record.isActive,
    createdAt: record.createdAt,
  });
}
