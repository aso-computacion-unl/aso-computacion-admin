import { requiredText } from "./text";

/** The only id the table accepts: site settings are a singleton. */
export const SITE_SETTINGS_ID = "site";

export const SITE_TAGLINE_MAX_LENGTH = 120;
export const SITE_DESCRIPTION_MAX_LENGTH = 300;
export const SITE_ABOUT_MAX_LENGTH = 600;

export interface SiteSettingsProps {
  readonly id: typeof SITE_SETTINGS_ID;
  readonly tagline: string;
  readonly description: string;
  readonly about: string;
  readonly updatedAt: Date;
}

export interface SiteSettingsInput {
  tagline: string;
  description: string;
  about: string;
}

export class SiteSettings {
  private constructor(readonly props: SiteSettingsProps) {}

  /** The three texts are always edited together, so there is no partial update: each save builds the whole value. */
  static create(input: SiteSettingsInput): SiteSettings {
    return new SiteSettings({
      id: SITE_SETTINGS_ID,
      tagline: requiredText("tagline", input.tagline, SITE_TAGLINE_MAX_LENGTH),
      description: requiredText("description", input.description, SITE_DESCRIPTION_MAX_LENGTH),
      about: requiredText("about", input.about, SITE_ABOUT_MAX_LENGTH),
      updatedAt: new Date(),
    });
  }

  /** Rehydrates the settings from trusted persistence data without validation. */
  static reconstitute(props: SiteSettingsProps): SiteSettings {
    return new SiteSettings(props);
  }
}
