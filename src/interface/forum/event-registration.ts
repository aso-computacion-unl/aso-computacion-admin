"use server";

/*
 * Student-facing action to register for an event with the institutional (UNL) Google account.
 *
 *   registerForEvent(slug)  -> { success } | { error }
 *
 * It takes no personal data from the caller: the name and email stored are the ones the forum holds for the
 * signed-in member, verified by Google at sign-in. One registration per person and event; capacity and
 * deadline are decided atomically by the repository. Not an admin action: only a `forum_session` passes.
 */

import { revalidatePath } from "next/cache";

import type { RegistrationRefusal } from "@/domain/event-registration";
import { mapRegistrationActionError } from "@/interface/event-registration/registration-action-errors";
import { getEventRegistrationServices } from "@/interface/public/event-registration-container";

import type { ForumActionResult } from "./forum-action-result";
import { requireForumMember } from "./require-forum-member";

const REFUSAL_MESSAGES: Record<RegistrationRefusal, string> = {
  duplicate: "Ya está inscrito en este evento.",
  full: "Ya no quedan cupos para este evento.",
  closed: "Las inscripciones de este evento ya cerraron.",
  mode_mismatch: "Este evento no admite inscripción con cuenta UNL.",
  not_found: "No se encontró el evento.",
};

export async function registerForEvent(slug: string): Promise<ForumActionResult> {
  try {
    const member = await requireForumMember();
    const outcome = await getEventRegistrationServices().registerUnl.execute({ slug: String(slug), memberId: member.memberId });

    if (outcome.status !== "registered") {
      return { error: REFUSAL_MESSAGES[outcome.status] };
    }

    revalidatePath(`/inscripciones/${slug}`);

    return { success: true };
  } catch (error) {
    return mapRegistrationActionError(error);
  }
}
