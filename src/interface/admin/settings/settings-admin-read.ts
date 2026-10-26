import "server-only";

import { getSiteSettingsUseCases } from "./settings-container";
import { requirePageSession } from "../../auth/require-page-session";

/** The saved site texts, or null when they were never saved. */
export async function getAdminSiteSettings() {
  await requirePageSession("ADMIN");
  return getSiteSettingsUseCases().get.execute();
}
