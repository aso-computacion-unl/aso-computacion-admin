import "server-only";

import { getEventUseCases } from "../events/events-container";
import { requirePageSession } from "../../auth/require-page-session";

/** The events «Crear inscripción» can pick: upcoming, published or drafts, without registration. Any signed-in user, like editing an event. */
export async function getAdminRegistrationCandidates() {
  await requirePageSession();

  return getEventUseCases().registrationCandidates.execute({ now: new Date() });
}
