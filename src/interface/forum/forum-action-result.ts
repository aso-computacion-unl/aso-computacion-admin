import { ZodError } from "zod";

import { ForumThrottledError } from "@/application/forum/posting-throttle";
import { ForbiddenError, NotFoundError } from "@/application/use-cases/use-case-error";
import { ValidationError } from "@/domain/domain-error";
import { ForumAlreadyReportedError, ForumMemberSuspendedError, ForumNotThreadAuthorError, ForumPostNotOwnedError, ForumThreadLockedError } from "@/domain/forum";
import { reportError } from "@/infrastructure/observability/report-error";

import { ForumUnauthorizedError } from "./require-forum-member";

/**
 * Result of every student-facing forum server action. `fieldErrors` carries per-field messages, `error`
 * a single message for everything else (never both); `id` is the new thread or reply on success (or the
 * reply marked as the best answer); `sessionExpired` marks the refusal for a session that is gone, so a form
 * can keep what was typed and offer the sign-in; `reacted` and `count` answer a «me sirvió» toggle; `alreadyReported` marks the refusal of a second open
 * report on the same post, which the UI shows as a state, not as a failure.
 */
export interface ForumActionResult {
  success?: true;
  id?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
  sessionExpired?: true;
  reacted?: boolean;
  count?: number;
  alreadyReported?: true;
}

export const FORUM_SESSION_EXPIRED_MESSAGE = "Inicie sesión para participar en el foro.";
export const FORUM_SESSION_EXPIRED_RESULT: ForumActionResult = { error: FORUM_SESSION_EXPIRED_MESSAGE, sessionExpired: true };
const FORUM_ACCOUNT_MESSAGE = "Su cuenta no puede participar en el foro.";
const GENERIC_ERROR_MESSAGE = "Ocurrió un error inesperado. Intente nuevamente.";

const FIELD_MESSAGES: Record<string, string> = {
  title: "El título es obligatorio y admite hasta 120 caracteres.",
  reason: "Cuéntenos el motivo en hasta 500 caracteres.",
  body: "El texto es obligatorio y admite hasta 10000 caracteres en un hilo y 5000 en una respuesta.",
};

function fieldError(field: string, message?: string): ForumActionResult {
  return { fieldErrors: { [field]: message ?? FIELD_MESSAGES[field] ?? "El valor no es válido." } };
}

/** Maps whatever a forum action caught to a Spanish result. Unknown errors are reported and reduced to a generic message. */
export function mapForumActionError(error: unknown): ForumActionResult {
  if (error instanceof ForumUnauthorizedError) {
    return FORUM_SESSION_EXPIRED_RESULT;
  }

  if (error instanceof ForumMemberSuspendedError || error instanceof ForbiddenError) {
    return { error: FORUM_ACCOUNT_MESSAGE };
  }

  if (error instanceof ForumThreadLockedError) {
    return { error: "Este hilo está cerrado: no admite respuestas ni cambios." };
  }

  if (error instanceof ForumPostNotOwnedError) {
    return { error: "Solo puede editar sus propias publicaciones." };
  }

  if (error instanceof ForumNotThreadAuthorError) {
    return { error: "Solo quien abrió el hilo puede elegir la mejor respuesta." };
  }

  if (error instanceof ForumAlreadyReportedError) {
    return { error: "Ya reportó esta publicación. El equipo la revisará.", alreadyReported: true };
  }

  if (error instanceof ForumThrottledError) {
    const minutes = Math.ceil(error.retryAfterSeconds / 60);

    return { error: `Está publicando muy rápido: el límite es de ${error.max} publicaciones por ${error.per}. Puede volver a intentarlo en ${minutes} ${minutes === 1 ? "minuto" : "minutos"}.` };
  }

  if (error instanceof NotFoundError) {
    return { error: "No se encontró la publicación." };
  }

  if (error instanceof ZodError) {
    const issue = error.issues[0];

    return issue?.code === "unrecognized_keys" ? fieldError("form", "El formulario incluye campos no admitidos.") : fieldError(String(issue?.path[0] ?? "form"), issue?.message);
  }

  if (error instanceof ValidationError) {
    return fieldError(error.field);
  }

  console.error("A forum action failed unexpectedly.");
  reportError(error, { action: "forum-action" });

  return { error: GENERIC_ERROR_MESSAGE };
}
