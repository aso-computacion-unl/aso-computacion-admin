import type { SiteSettingsRepository } from "@/application/ports/site-settings-repository.port";
import type { SiteSettings } from "@/domain/site-settings";

/** Single-slot in-memory `SiteSettingsRepository`: `save` replaces whatever was there. */
export class InMemorySiteSettingsRepository implements SiteSettingsRepository {
  private current: SiteSettings | null = null;

  async get(): Promise<SiteSettings | null> {
    return this.current;
  }

  async save(settings: SiteSettings): Promise<SiteSettings> {
    this.current = settings;
    return settings;
  }
}
