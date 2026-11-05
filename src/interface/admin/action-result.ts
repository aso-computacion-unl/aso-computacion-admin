import { ZodError } from "zod";

import { LastAdminError, UserEmailTakenError } from "@/application/auth/auth-errors";
import { ForbiddenError, NotFoundError, RestoreConflictError } from "@/application/use-cases/use-case-error";
import {
  CommandNameConflictError,
  ImageTooLargeError,
  ImageTooSmallError,
  InvalidImageFormatError,
  ValidationError,
} from "@/domain";
import { reportError } from "@/infrastructure/observability/report-error";

import { UnauthorizedError } from "../auth/require-session";
import { fieldMessage } from "./field-messages";

/**
 * Result of every admin server action. `fieldErrors` carries per-field
 * messages; `error` a single message for everything else. Never both.
 */
export interface ActionResult {
  success?: true;
  /** With `success`: the request found the target already in the wanted state, so nothing changed and nothing was audited. */
  unchanged?: true;
  error?: string;
  fieldErrors?: Record<string, string>;
}

/** The one message of a result, whichever way it was reported: the error, else the first field error. */
export function resultText(result: ActionResult): string {
  return result.error ?? Object.values(result.fieldErrors ?? {})[0] ?? "Ocurrió un error inesperado. Intente nuevamente.";
}

export const SESSION_EXPIRED_MESSAGE = "Su sesión expiró. Inicie sesión de nuevo.";
export const FORBIDDEN_MESSAGE = "No tiene permiso para realizar esta acción.";
const GENERIC_ERROR_MESSAGE = "Ocurrió un error inesperado. Intente nuevamente.";
// NotFoundError texts by entity; anything else keeps the generic event/photo wording.
const NOT_FOUND_MESSAGES: Record<string, string> = {
  "Faq not found": "No se encontró la pregunta frecuente.",
  "Terminal command not found": "No se encontró el comando.",
  "Social link not found": "No se encontró la red social.",
  "Pillar not found": "No se encontró el pilar.",
  "Board member not found": "No se encontró al integrante de la directiva.",
  "Sponsor not found": "No se encontró al aliado.",
  "User not found": "No se encontró el usuario.",
  "Session not found": "La sesión ya no está activa.",
  "Invite not found": "La invitación ya no está pendiente.",
  "Registration not found": "No se encontró la inscripción.",
};

const COMMAND_CONFLICT_MESSAGES = {
  reserved: (command: string) => `«${command}» es una palabra reservada del terminal. Elija otra.`,
  faq: (command: string) => `«${command}» ya lo usa una pregunta frecuente. Elija otro nombre.`,
  command: (command: string) => `«${command}» ya lo usa otro comando. Elija otro nombre.`,
} as const;

// Restoring cannot rename anything, so the message says what to change first.
const RESTORE_CONFLICT_MESSAGES = {
  event: (value: string) => `No se puede restaurar: el identificador «${value}» ya lo usa otro evento. Cambie o elimine ese evento y vuelva a intentarlo.`,
  news: (value: string) => `No se puede restaurar: el identificador «${value}» ya lo usa otra noticia. Cambie o elimine esa noticia y vuelva a intentarlo.`,
  faq: (value: string) => `No se puede restaurar: «${value}» ya lo usa una pregunta frecuente. Cambie o elimine esa pregunta y vuelva a intentarlo.`,
  command: (value: string) => `No se puede restaurar: «${value}» ya lo usa otro comando. Cambie o elimine ese comando y vuelva a intentarlo.`,
} as const;

const UNKNOWN_FIELDS_MESSAGE = "El formulario incluye campos no admitidos.";

function fieldError(field: string, message?: string, overrides?: Record<string, string>): ActionResult {
  return { fieldErrors: { [field]: message ?? fieldMessage(field, overrides) } };
}

/**
 * Maps whatever an action caught to a Spanish `ActionResult`. Unknown errors
 * are logged and reduced to a generic message: nothing internal leaks out.
 * `fieldMessages` overrides the shared text of a field whose limits differ per
 * entity (a pillar title admits 60 characters, an event title 120).
 */
export function mapActionError(error: unknown, fieldMessages?: Record<string, string>): ActionResult {
  if (error instanceof UnauthorizedError) {
    return { error: SESSION_EXPIRED_MESSAGE };
  }

  if (error instanceof ForbiddenError) {
    return { error: FORBIDDEN_MESSAGE };
  }

  if (error instanceof LastAdminError) {
    return { error: "No se puede quitar ni degradar al último administrador activo." };
  }

  if (error instanceof UserEmailTakenError) {
    return fieldError("email", "Ese correo ya está registrado.");
  }

  if (error instanceof ZodError) {
    // Fields the form should not carry only matter when no real field is wrong: they point at a broken form.
    const issues = error.issues.filter((issue) => issue.code !== "unrecognized_keys");

    if (issues.length === 0 && error.issues.length > 0) {
      return fieldError("form", UNKNOWN_FIELDS_MESSAGE);
    }

    // Every rejected field, so the form shows them all at once; a field that fails twice keeps its first message.
    const fieldErrors: Record<string, string> = {};

    for (const issue of issues) {
      const field = String(issue.path[0] ?? "form");

      if (!(field in fieldErrors)) fieldErrors[field] = field === "file" ? fieldMessage("file") : issue.message;
    }

    return Object.keys(fieldErrors).length > 0 ? { fieldErrors } : fieldError("form");
  }

  if (error instanceof CommandNameConflictError) {
    return fieldError(error.field, COMMAND_CONFLICT_MESSAGES[error.conflict](error.command));
  }

  if (error instanceof RestoreConflictError) {
    return { error: RESTORE_CONFLICT_MESSAGES[error.owner](error.value) };
  }

  if (error instanceof ValidationError) {
    return fieldError(error.field, undefined, fieldMessages);
  }

  if (error instanceof InvalidImageFormatError) {
    return fieldError("file");
  }

  if (error instanceof ImageTooLargeError) {
    return fieldError("file", "La imagen supera el máximo de 5 MB.");
  }

  if (error instanceof ImageTooSmallError) {
    return fieldError(
      "file",
      `La imagen debe tener al menos ${error.minWidth} px de ancho (esta tiene ${error.width} px).`,
    );
  }

  if (error instanceof NotFoundError) {
    return { error: NOT_FOUND_MESSAGES[error.message] ?? "No se encontró el evento o la foto." };
  }

  console.error(error);
  reportError(error);

  return { error: GENERIC_ERROR_MESSAGE };
}
