import "server-only";

import { NotFoundError } from "@/application";
import { publicOrigin } from "@/infrastructure/auth/auth-config";
import { getEventRegistrationServices } from "@/interface/public/event-registration-container";

import { requirePageSession } from "../../auth/require-page-session";

/**
 * The registrations of one event for its admin page, or null when the event does not exist. Personal data:
 * any signed-in user (ADMIN or EDITOR) may look; `canManage` is true only for an ADMIN, who alone may export or delete.
 * `adminOrigin` (from `AUTH_URL`, undefined when unset) builds the forum registration link of a UNL event.
 */
export async function getAdminEventRegistrations(eventId: string) {
  const actor = await requirePageSession();

  try {
    const { event, registrations } = await getEventRegistrationServices().list.execute({ eventId });

    return { event, registrations, canManage: actor.role === "ADMIN", adminOrigin: publicOrigin(process.env.AUTH_URL) };
  } catch (error) {
    if (error instanceof NotFoundError) return null;
    throw error;
  }
}
