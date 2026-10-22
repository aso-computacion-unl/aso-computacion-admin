import type { SiteSettings } from "@/domain/site-settings";

/** Persistence port for the site settings singleton. */
export interface SiteSettingsRepository {
  /** The saved settings, or null when they were never saved. */
  get(): Promise<SiteSettings | null>;
  /** Inserts the single row on first save and replaces it afterwards. */
  save(settings: SiteSettings): Promise<SiteSettings>;
}
