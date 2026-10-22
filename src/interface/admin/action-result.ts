import { ZodError } from "zod";

import { NotFoundError } from "@/application/use-cases/use-case-error";
import {
  ImageTooLargeError,
  ImageTooSmallError,
  InvalidImageFormatError,
  ValidationError,
} from "@/domain";
import { MAX_ACTIVE_EVENT_PHOTOS } from "@/domain/event-photo";

import { UnauthorizedError } from "../auth/require-admin-session";

/**
 * Result of every admin server action. `fieldErrors` carries per-field
 * messages; `error` a single message for everything else. Never both.
 */
export interface ActionResult {
  success?: true;
  error?: string;
  fieldErrors?: Record<string, string>;
}

export const SESSION_EXPIRED_MESSAGE = "Su sesión expiró. Inicie sesión de nuevo.";
const GENERIC_ERROR_MESSAGE = "Ocurrió un error inesperado. Intente nuevamente.";
const IMAGE_FORMAT_MESSAGE = "Elija una imagen JPEG, PNG o WebP de hasta 5 MB.";

const FIELD_MESSAGES: Record<string, string> = {
  title: "El título es obligatorio y admite hasta 120 caracteres.",
  slug: "El identificador solo admite minúsculas, números y guiones, y no puede repetirse.",
  description: "La descripción admite hasta 600 caracteres.",
  date: "Indique una fecha válida.",
  type: "Elija un tipo de la lista.",
  commitMessage: "El mensaje admite hasta 80 caracteres.",
  hora: "Admite hasta 80 caracteres.",
  lugar: "Admite hasta 80 caracteres.",
  para: "Admite hasta 80 caracteres.",
  linkUrl: "Use un enlace que empiece con https://.",
  linkLabel: "El texto del enlace admite hasta 80 caracteres y requiere un enlace.",
  highlights: "Hasta 8 líneas de 80 caracteres como máximo.",
  question: "La pregunta es obligatoria y admite hasta 200 caracteres.",
  answer: "La respuesta es obligatoria y admite hasta 1000 caracteres.",
  platform: "Elija una red de la lista.",
  label: "El nombre es obligatorio y admite hasta 40 caracteres.",
  handle: "El usuario es obligatorio y admite hasta 60 caracteres.",
  url: "Use un enlace que empiece con https://.",
  note: "La nota admite hasta 40 caracteres.",
  blurb: "La descripción corta admite hasta 80 caracteres.",
  alt: "Describa la foto en 1 a 200 caracteres.",
  file: IMAGE_FORMAT_MESSAGE,
  photos: `El evento ya tiene ${MAX_ACTIVE_EVENT_PHOTOS} fotos activas. Quite una para subir otra.`,
};

// NotFoundError texts by entity; anything else keeps the generic event/photo wording.
const NOT_FOUND_MESSAGES: Record<string, string> = {
  "Faq not found": "No se encontró la pregunta frecuente.",
  "Social link not found": "No se encontró la red social.",
};

const UNKNOWN_FIELDS_MESSAGE = "El formulario incluye campos no admitidos.";

function fieldError(field: string, message?: string): ActionResult {
  return { fieldErrors: { [field]: message ?? FIELD_MESSAGES[field] ?? "El valor no es válido." } };
}

/**
 * Maps whatever an action caught to a Spanish `ActionResult`. Unknown errors
 * are logged and reduced to a generic message: nothing internal leaks out.
 */
export function mapActionError(error: unknown): ActionResult {
  if (error instanceof UnauthorizedError) {
    return { error: SESSION_EXPIRED_MESSAGE };
  }

  if (error instanceof ZodError) {
    const issue = error.issues[0];

    if (issue?.code === "unrecognized_keys") {
      return fieldError("form", UNKNOWN_FIELDS_MESSAGE);
    }

    return fieldError(String(issue?.path[0] ?? "form"), issue?.path[0] === "file" ? undefined : issue?.message);
  }

  if (error instanceof ValidationError) {
    return fieldError(error.field);
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

  return { error: GENERIC_ERROR_MESSAGE };
}
