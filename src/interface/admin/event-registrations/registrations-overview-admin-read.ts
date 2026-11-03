import "server-only";

import { getEventRegistrationServices } from "@/interface/public/event-registration-container";

import { requirePageSession } from "../../auth/require-page-session";

/**
 * Every event that takes registrations, upcoming first and then past, with its counts: the page that gathers
 * the per-event ones. Counts only, so any signed-in user (ADMIN or EDITOR) may look, like the per-event page.
 */
export async function getAdminRegistrationOverview() {
  await requirePageSession();

  return getEventRegistrationServices().overview.execute({ now: new Date() });
}
