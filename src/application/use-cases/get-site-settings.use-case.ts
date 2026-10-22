import type { SiteSettingsResult } from "../dto/site-settings-result.dto";
import { toSiteSettingsResult } from "../mappers/site-settings-result.mapper";
import type { SiteSettingsRepository } from "../ports/site-settings-repository.port";

/**
 * Returns null, not invented defaults, until the settings are first saved: the
 * landing keeps its own copy of these texts as the fallback, so the admin has
 * nothing to guess. The form simply starts empty.
 */
export class GetSiteSettingsUseCase {
  constructor(private readonly settings: SiteSettingsRepository) {}

  async execute(): Promise<SiteSettingsResult | null> {
    const current = await this.settings.get();

    return current && toSiteSettingsResult(current);
  }
}
