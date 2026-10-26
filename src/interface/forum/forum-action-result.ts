import { ZodError } from "zod";

import { ForumThrottledError } from "@/application/forum/posting-throttle";
import { ForbiddenError, NotFoundError } from "@/application/use-cases/use-case-error";
import { ValidationError } from "@/domain/domain-error";
import { ForumMemberSuspendedError, ForumPostNotOwnedError, ForumThreadLockedError } from "@/domain/forum";
import { reportError } from "@/infrastructure/observability/report-error";

import { ForumUnauthorizedError } from "./require-forum-member";

/**
 * Result of every student-facing forum server action. `fieldErrors` carries per-field messages, `error`
 * a single message for everything else (never both); `id` is the new thread or reply on success;
 * `retryAfterSeconds` is set when the member is posting too fast.
 */
export interface ForumActionResult {
  success?: true;
  id?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
  retryAfterSeconds?: number;
}

export const FORUM_SESSION_EXPIRED_MESSAGE = "Inicie sesión para participar en el foro.";
const FORUM_ACCOUNT_MESSAGE = "Su cuenta no puede participar en el foro.";
const GENERIC_ERROR_MESSAGE = "Ocurrió un error inesperado. Intente nuevamente.";

const FIELD_MESSAGES: Record<string, string> = {
  title: "El título es obligatorio y admite hasta 120 caracteres.",
  body: "El texto es obligatorio y admite hasta 10000 caracteres en un hilo y 5000 en una respuesta.",
};

function fieldError(field: string, message?: string): ForumActionResult {
  return { fieldErrors: { [field]: message ?? FIELD_MESSAGES[field] ?? "El valor no es válido." } };
}

/** Maps whatever a forum action caught to a Spanish result. Unknown errors are reported and reduced to a generic message. */
export function mapForumActionError(error: unknown): ForumActionResult {
  if (error instanceof ForumUnauthorizedError) {
    return { error: FORUM_SESSION_EXPIRED_MESSAGE };
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

  if (error instanceof ForumThrottledError) {
    return { error: "Está publicando muy rápido. Espere un momento y vuelva a intentarlo.", retryAfterSeconds: error.retryAfterSeconds };
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
