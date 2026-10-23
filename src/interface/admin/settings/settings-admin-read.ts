import "server-only";

import { getSiteSettingsUseCases } from "./settings-container";

/** The saved site texts, or null when they were never saved. */
export function getAdminSiteSettings() {
  return getSiteSettingsUseCases().get.execute();
}
