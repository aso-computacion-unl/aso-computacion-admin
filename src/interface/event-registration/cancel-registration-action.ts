"use server";

/*
 * Student-facing action to cancel a UNL registration from the event page (D7).
 *
 *   cancelEventRegistration(slug)  -> { success } | { error }
 *
 * It takes nothing about the registration from the caller: the one deleted is the registration of the signed-in
 * member's verified institutional address, so no one can cancel (or learn about) another person's. Deleting it frees
 * the seat atomically; a closed event refuses and leaves everything as it was. Not an admin action: only a
 * `forum_session` passes. A cancellation leaves one audit entry without personal data (`auditSelfCancellation`).
 */

import { revalidatePath } from "next/cache";

import { auditSelfCancellation } from "@/interface/event-registration/audit-self-cancellation";
import { mapCancellationActionError } from "@/interface/event-registration/registration-action-errors";
import type { ForumActionResult } from "@/interface/forum/forum-action-result";
import { requireForumMember } from "@/interface/forum/require-forum-member";
import { getEventRegistrationServices } from "@/interface/public/event-registration-container";

const MESSAGES = {
  not_registered: "Usted no tiene una inscripción en este evento.",
  closed: "Las inscripciones de este evento ya cerraron, así que ya no se puede cancelar desde aquí. Si no podrá asistir, escriba a la directiva de ASO.",
  not_found: "No se encontró el evento.",
} as const;

export async function cancelEventRegistration(slug: string): Promise<ForumActionResult> {
  try {
    const member = await requireForumMember();
    const outcome = await getEventRegistrationServices().cancelUnl.execute({ slug: String(slug), memberId: member.memberId });

    if (outcome.status === "cancelled") {
      await auditSelfCancellation(outcome.eventId, "unl_page");
    }

    // Cancelled, or not registered any more (another tab, staff): the page behind must show the real state either way.
    if (outcome.status === "cancelled" || outcome.status === "not_registered") {
      revalidatePath(`/inscripciones/${slug}`);
    }

    return outcome.status === "cancelled" ? { success: true } : { error: MESSAGES[outcome.status] };
  } catch (error) {
    return mapCancellationActionError(error);
  }
}
