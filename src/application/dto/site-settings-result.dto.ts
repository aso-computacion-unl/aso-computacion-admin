/** Plain shape returned by the site settings use cases, without exposing the entity. */
export interface SiteSettingsResult {
  tagline: string;
  description: string;
  about: string;
  updatedAt: Date;
}
