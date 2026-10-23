import { SiteSettings, type SiteSettingsInput } from "@/domain/site-settings";

import type { SiteSettingsResult } from "../dto/site-settings-result.dto";
import { toSiteSettingsResult } from "../mappers/site-settings-result.mapper";
import type { SiteSettingsRepository } from "../ports/site-settings-repository.port";

/** Validates the three texts and upserts the single row; a rejected value saves nothing. */
export class UpdateSiteSettingsUseCase {
  constructor(private readonly settings: SiteSettingsRepository) {}

  async execute(command: SiteSettingsInput): Promise<SiteSettingsResult> {
    return toSiteSettingsResult(await this.settings.save(SiteSettings.create(command)));
  }
}
