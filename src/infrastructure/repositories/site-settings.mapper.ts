import type { SiteSettings as PrismaSiteSettings, Prisma } from "@prisma/client";

import { SITE_SETTINGS_ID, SiteSettings } from "@/domain/site-settings";

export function toDomain(record: PrismaSiteSettings): SiteSettings {
  return SiteSettings.reconstitute({
    // The CHECK constraint guarantees the only possible id.
    id: SITE_SETTINGS_ID,
    tagline: record.tagline,
    description: record.description,
    about: record.about,
    updatedAt: record.updatedAt,
  });
}

export function toPrismaData({ props }: SiteSettings): Prisma.SiteSettingsUncheckedCreateInput {
  return { ...props };
}
