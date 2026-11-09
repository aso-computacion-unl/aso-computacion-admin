import { registrationChangeImpacts, type EventRegistrationMode } from "@/domain/event-registration";

import { getEventUseCases } from "./events-container";
import { registrationChangeText } from "./registration-change";

/** The form field that says the admin saw the question and went on (D14). Only this exact value counts. */
export const REGISTRATION_CHANGE_CONFIRMED_FIELD = "confirmRegistrationChange";

export function isRegistrationChangeConfirmed(formData: FormData): boolean {
  return formData.get(REGISTRATION_CHANGE_CONFIRMED_FIELD) === "on";
}

interface SubmittedRegistration {
  registrationMode?: EventRegistrationMode;
  /** `undefined`: the form did not send it; `null`: it sent it blank (no limit). */
  registrationCapacity?: number | null;
}

/**
 * D14: the message to answer instead of saving, or `null` when the save may go on. A save that changes the mode, or
 * sets seats below the people already registered (confirmed ones only), needs the confirmation the form's question
 * sends; without it the server stores nothing, so no client can skip the question. A save that sends no registration
 * setting reads nothing: it leaves them as they are.
 */
export async function unconfirmedRegistrationChange(eventId: string, submitted: SubmittedRegistration, confirmed: boolean): Promise<string | null> {
  if (confirmed || (submitted.registrationMode === undefined && submitted.registrationCapacity === undefined)) {
    return null;
  }

  const useCases = getEventUseCases();
  const event = await useCases.get.execute({ id: eventId });
  const registered = await useCases.registeredCount(eventId);
  const next = { mode: submitted.registrationMode, capacity: submitted.registrationCapacity };
  const impacts = registrationChangeImpacts({ registered, current: { mode: event.registrationMode, capacity: event.registrationCapacity }, next });

  if (impacts.length === 0) {
    return null;
  }

  const mode = next.mode ?? event.registrationMode;
  const capacity = mode === "none" ? null : next.capacity === undefined ? event.registrationCapacity : next.capacity;

  return registrationChangeText({ registered, impacts, next: { mode, capacity } });
}
