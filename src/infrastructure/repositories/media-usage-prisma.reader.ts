import "server-only";

import type { MediaUsage, MediaUsageReader } from "@/application/ports/media-library.port";

import { prisma } from "../prisma/client";

/**
 * Finds the rows that point at a stored image: event photos (also the ones taken off the event,
 * which keep their file), pillar images, news covers, board photos, testimonial photos
 * and sponsor logos. A row in the trash still
 * owns its image, so it counts as a use (marked hidden): its file is destroyed only when the row
 * is deleted for good.
 *
 * These queries are the columns listed in `MEDIA_OWNERS` (`@/application/media-owners`), which
 * also fixes the folders orphan cleanup may touch. Add a query here and a row there together; a
 * unit test reads `prisma/schema.prisma` and fails on a `*PublicId` column that is in neither.
 */
export class MediaUsagePrismaReader implements MediaUsageReader {
  async usagesOf(publicIds: readonly string[]): Promise<Map<string, MediaUsage[]>> {
    const usages = new Map<string, MediaUsage[]>();

    if (publicIds.length === 0) return usages;

    const ids = [...publicIds];
    const add = (publicId: string | null, usage: MediaUsage) => {
      if (publicId === null) return;

      usages.set(publicId, [...(usages.get(publicId) ?? []), usage]);
    };
    const [photos, pillars, news, members, testimonials, sponsors] = await Promise.all([
      prisma.eventPhoto.findMany({ where: { publicId: { in: ids } }, select: { publicId: true, isActive: true, event: { select: { id: true, title: true, deletedAt: true } } } }),
      prisma.pillar.findMany({ where: { imagePublicId: { in: ids } }, select: { imagePublicId: true, id: true, title: true, deletedAt: true } }),
      prisma.newsItem.findMany({ where: { coverPublicId: { in: ids } }, select: { coverPublicId: true, id: true, title: true, deletedAt: true } }),
      prisma.boardMember.findMany({ where: { photoPublicId: { in: ids } }, select: { photoPublicId: true, id: true, name: true, deletedAt: true } }),
      prisma.testimonial.findMany({ where: { photoPublicId: { in: ids } }, select: { photoPublicId: true, id: true, name: true, deletedAt: true } }),
      prisma.sponsor.findMany({ where: { logoPublicId: { in: ids } }, select: { logoPublicId: true, id: true, name: true, deletedAt: true } }),
    ]);

    for (const photo of photos) {
      add(photo.publicId, { kind: "event", id: photo.event.id, label: photo.event.title, hidden: !photo.isActive || photo.event.deletedAt !== null });
    }
    for (const pillar of pillars) add(pillar.imagePublicId, { kind: "pillar", id: pillar.id, label: pillar.title, hidden: pillar.deletedAt !== null });
    for (const item of news) add(item.coverPublicId, { kind: "news", id: item.id, label: item.title, hidden: item.deletedAt !== null });
    for (const member of members) add(member.photoPublicId, { kind: "board", id: member.id, label: member.name, hidden: member.deletedAt !== null });
    for (const testimonial of testimonials) add(testimonial.photoPublicId, { kind: "testimonial", id: testimonial.id, label: testimonial.name, hidden: testimonial.deletedAt !== null });
    for (const sponsor of sponsors) add(sponsor.logoPublicId, { kind: "sponsor", id: sponsor.id, label: sponsor.name, hidden: sponsor.deletedAt !== null });

    return usages;
  }
}
