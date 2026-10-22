import type { SiteSettings } from "@/domain/site-settings";

import type { SiteSettingsResult } from "../dto/site-settings-result.dto";

export function toSiteSettingsResult({ props }: SiteSettings): SiteSettingsResult {
  return { tagline: props.tagline, description: props.description, about: props.about, updatedAt: props.updatedAt };
}
