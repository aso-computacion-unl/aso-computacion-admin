import "server-only";

import type { SiteSettingsRepository } from "@/application/ports/site-settings-repository.port";
import { SITE_SETTINGS_ID, type SiteSettings } from "@/domain/site-settings";

import { prisma } from "../prisma/client";
import { toDomain, toPrismaData } from "./site-settings.mapper";

export class SiteSettingsPrismaRepository implements SiteSettingsRepository {
  async get(): Promise<SiteSettings | null> {
    const record = await prisma.siteSettings.findUnique({ where: { id: SITE_SETTINGS_ID } });

    return record ? toDomain(record) : null;
  }

  async save(settings: SiteSettings): Promise<SiteSettings> {
    const data = toPrismaData(settings);

    return toDomain(await prisma.siteSettings.upsert({ where: { id: SITE_SETTINGS_ID }, create: data, update: data }));
  }
}
