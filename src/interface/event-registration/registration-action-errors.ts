import { ForbiddenError, NotFoundError } from "@/application/use-cases/use-case-error";
import { ForumMemberSuspendedError } from "@/domain/forum";
import { mapForumActionError, type ForumActionResult } from "@/interface/forum/forum-action-result";
import { ForumUnauthorizedError } from "@/interface/forum/require-forum-member";

/**
 * What a student is told when a UNL registration is refused for who they are (D5). The sign-in under the hood is the
 * forum's, but nothing a person reads in the registrations says "foro": the forum's own messages are about posting.
 * `sessionExpired` lets the screen offer the sign-in, which returns to the same event page.
 */
export const REGISTRATION_SESSION_EXPIRED_RESULT: ForumActionResult = {
  error: "Su sesión terminó. Entre de nuevo con su cuenta @unl.edu.ec para reservar su cupo.",
  sessionExpired: true,
};

const REGISTRATION_ACCOUNT_MESSAGE = "Su cuenta no puede reservar cupos. Use su cuenta institucional @unl.edu.ec.";
const EVENT_NOT_FOUND_MESSAGE = "No se encontró el evento.";

/** Maps whatever the UNL registration action caught to a Spanish result in registration words; anything else is the shared mapping's. */
export function mapRegistrationActionError(error: unknown): ForumActionResult {
  if (error instanceof ForumUnauthorizedError) {
    return REGISTRATION_SESSION_EXPIRED_RESULT;
  }

  if (error instanceof ForumMemberSuspendedError || error instanceof ForbiddenError) {
    return { error: REGISTRATION_ACCOUNT_MESSAGE };
  }

  if (error instanceof NotFoundError) {
    return { error: EVENT_NOT_FOUND_MESSAGE };
  }

  return mapForumActionError(error);
}

/** The cancellation's own wording (D7) for the two refusals that name what the student was trying to do. */
export const CANCELLATION_SESSION_EXPIRED_RESULT: ForumActionResult = {
  error: "Su sesión terminó. Entre de nuevo con su cuenta @unl.edu.ec para cancelar su inscripción.",
  sessionExpired: true,
};

const CANCELLATION_ACCOUNT_MESSAGE = "Su cuenta no puede cancelar cupos. Use su cuenta institucional @unl.edu.ec.";

/** Like `mapRegistrationActionError`, for the action that cancels: same rules, said about cancelling instead of reserving. */
export function mapCancellationActionError(error: unknown): ForumActionResult {
  if (error instanceof ForumUnauthorizedError) {
    return CANCELLATION_SESSION_EXPIRED_RESULT;
  }

  if (error instanceof ForumMemberSuspendedError || error instanceof ForbiddenError) {
    return { error: CANCELLATION_ACCOUNT_MESSAGE };
  }

  return mapRegistrationActionError(error);
}
