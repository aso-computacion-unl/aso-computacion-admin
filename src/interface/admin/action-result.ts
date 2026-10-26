import { ZodError } from "zod";

import { NotFoundError } from "@/application/use-cases/use-case-error";
import {
  CommandNameConflictError,
  ImageTooLargeError,
  ImageTooSmallError,
  InvalidImageFormatError,
  ValidationError,
} from "@/domain";
import { MAX_ACTIVE_EVENT_PHOTOS } from "@/domain/event-photo";
import { reportError } from "@/infrastructure/observability/report-error";

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
  datePrecision: "Elija fecha exacta o solo mes.",
  type: "Elija un tipo de la lista.",
  commitMessage: "El mensaje admite hasta 80 caracteres.",
  hora: "Admite hasta 80 caracteres.",
  lugar: "Admite hasta 80 caracteres.",
  para: "Admite hasta 80 caracteres.",
  linkUrl: "Use un enlace que empiece con https://.",
  linkLabel: "El texto del enlace admite hasta 80 caracteres y requiere un enlace.",
  highlights: "Hasta 8 líneas de 80 caracteres como máximo.",
  command: "Use de 2 a 28 caracteres: minúsculas, números y guiones simples, empezando con una letra.",
  question: "La pregunta es obligatoria y admite hasta 200 caracteres.",
  answer: "La respuesta es obligatoria y admite hasta 1000 caracteres.",
  platform: "Elija una red de la lista.",
  label: "El nombre es obligatorio y admite hasta 40 caracteres.",
  handle: "El usuario es obligatorio y admite hasta 60 caracteres.",
  url: "Use un enlace que empiece con https://.",
  note: "La nota admite hasta 40 caracteres.",
  blurb: "La descripción corta admite hasta 80 caracteres.",
  word: "La palabra es obligatoria y admite hasta 20 caracteres.",
  text: "El texto es obligatorio y admite hasta 300 caracteres.",
  imageAlt: "Describa la imagen en 1 a 200 caracteres.",
  name: "El nombre es obligatorio y admite hasta 60 caracteres.",
  role: "El cargo es obligatorio y admite hasta 60 caracteres.",
  photo: "Suba una foto antes de publicar al integrante.",
  photoAlt: "Describa la foto en 1 a 200 caracteres.",
  alt: "Describa la foto en 1 a 200 caracteres.",
  file: IMAGE_FORMAT_MESSAGE,
  photos: `El evento ya tiene ${MAX_ACTIVE_EVENT_PHOTOS} fotos activas. Quite una para subir otra.`,
};

// NotFoundError texts by entity; anything else keeps the generic event/photo wording.
const NOT_FOUND_MESSAGES: Record<string, string> = {
  "Faq not found": "No se encontró la pregunta frecuente.",
  "Terminal command not found": "No se encontró el comando.",
  "Social link not found": "No se encontró la red social.",
  "Pillar not found": "No se encontró el pilar.",
  "Board member not found": "No se encontró al integrante de la directiva.",
};

const COMMAND_CONFLICT_MESSAGES = {
  reserved: (command: string) => `«${command}» es una palabra reservada del terminal. Elija otra.`,
  faq: (command: string) => `«${command}» ya lo usa una pregunta frecuente. Elija otro nombre.`,
  command: (command: string) => `«${command}» ya lo usa otro comando. Elija otro nombre.`,
} as const;

const UNKNOWN_FIELDS_MESSAGE = "El formulario incluye campos no admitidos.";

function fieldError(field: string, message?: string, overrides?: Record<string, string>): ActionResult {
  return { fieldErrors: { [field]: message ?? overrides?.[field] ?? FIELD_MESSAGES[field] ?? "El valor no es válido." } };
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

  if (error instanceof ZodError) {
    const issue = error.issues[0];

    if (issue?.code === "unrecognized_keys") {
      return fieldError("form", UNKNOWN_FIELDS_MESSAGE);
    }

    return fieldError(String(issue?.path[0] ?? "form"), issue?.path[0] === "file" ? undefined : issue?.message);
  }

  if (error instanceof CommandNameConflictError) {
    return fieldError(error.field, COMMAND_CONFLICT_MESSAGES[error.conflict](error.command));
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
