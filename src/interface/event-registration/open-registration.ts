/*
 * The browser half of the open registration form: it checks the fields with the domain's own rules before the
 * request (so a typo never spends a rate-limit attempt or a Turnstile token), posts to the public endpoint and
 * turns the answer into one outcome the form can show. The server still decides everything; nothing here is trusted.
 * No server-only imports: the form is a client component.
 */

import { ValidationError } from "@/domain/domain-error";
import {
  parseOpenRegistration,
  REGISTRATION_CAREER_MAX_LENGTH,
  REGISTRATION_INSTITUTION_MAX_LENGTH,
  REGISTRATION_NAME_MAX_LENGTH,
  REGISTRATION_SEMESTER_MAX,
} from "@/domain/event-registration";

import { errorCode, postToRegistrationEndpoint, retryAfterSeconds, waitText } from "./registration-endpoint-answer";

export const OPEN_FIELDS = ["name", "email", "institution", "career", "semester"] as const;
export type OpenField = (typeof OPEN_FIELDS)[number];
export type OpenFormValues = Record<OpenField, string>;
export type OpenFieldErrors = Partial<Record<OpenField, string>>;

// A value each field accepts, swapped in for one that failed so the next field can be checked in the same pass.
const ACCEPTED: OpenFormValues = { name: "x", email: "x@x.co", institution: "x", career: "x", semester: "1" };

const EMPTY_MESSAGES: Record<OpenField, string> = {
  name: "Escriba su nombre.",
  email: "Escriba su correo.",
  institution: "Escriba su institución.",
  career: "Escriba su carrera.",
  semester: `Elija su ciclo, del 1 al ${REGISTRATION_SEMESTER_MAX}.`,
};

// Control characters and lone surrogates: the same text the domain refuses to store.
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]|\p{Surrogate}/u;

/** What is wrong with a field the server (or the domain) refused, said for a student. */
export function fieldMessage(field: OpenField, value: string): string {
  const text = value.trim().replace(/\s+/g, " ");

  if (text === "") return EMPTY_MESSAGES[field];

  switch (field) {
    case "name":
      return CONTROL_CHARACTERS.test(text) ? "Su nombre tiene caracteres que no podemos guardar." : `Su nombre es muy largo: use hasta ${REGISTRATION_NAME_MAX_LENGTH} caracteres.`;
    case "institution":
      return CONTROL_CHARACTERS.test(text) ? "Su institución tiene caracteres que no podemos guardar." : `El nombre de su institución es muy largo: use hasta ${REGISTRATION_INSTITUTION_MAX_LENGTH} caracteres.`;
    case "career":
      return CONTROL_CHARACTERS.test(text) ? "Su carrera tiene caracteres que no podemos guardar." : `Su carrera es muy larga: use hasta ${REGISTRATION_CAREER_MAX_LENGTH} caracteres.`;
    case "email":
      return "Revise su correo: no parece una dirección válida.";
    case "semester":
      return EMPTY_MESSAGES.semester;
  }
}

function isOpenField(field: string): field is OpenField {
  return (OPEN_FIELDS as readonly string[]).includes(field);
}

/** Every field the server would refuse, with its message; an empty object means the form can be sent. */
export function validateOpenForm(values: OpenFormValues): OpenFieldErrors {
  const errors: OpenFieldErrors = {};
  const probe = { ...values };

  for (let pass = 0; pass < OPEN_FIELDS.length; pass += 1) {
    try {
      parseOpenRegistration(probe);

      return errors;
    } catch (error) {
      if (!(error instanceof ValidationError) || !isOpenField(error.field)) throw error;

      errors[error.field] = fieldMessage(error.field, values[error.field]);
      probe[error.field] = ACCEPTED[error.field];
    }
  }

  return errors;
}

export function openPayload(values: OpenFormValues, turnstileToken: string | null): Record<string, unknown> {
  return {
    name: values.name,
    email: values.email,
    institution: values.institution,
    // Career and semester are optional: an empty one is left out rather than sent blank.
    ...(values.career.trim() ? { career: values.career } : {}),
    ...(values.semester ? { semester: Number(values.semester) } : {}),
    ...(turnstileToken ? { turnstileToken } : {}),
  };
}

export type OpenOutcome =
  | { kind: "registered" }
  | { kind: "field"; field: OpenField }
  | { kind: "duplicate" | "full" | "closed" | "not_found" | "captcha" | "unavailable" | "email_unavailable" | "email_budget" | "failed" }
  | { kind: "rate_limited"; retryAfterSeconds: number | null };

/** Refusals after which this page has nothing left to offer the person: the form gives way to the state. */
export function endsRegistration(outcome: OpenOutcome): outcome is { kind: "full" | "closed" | "not_found" } {
  return outcome.kind === "full" || outcome.kind === "closed" || outcome.kind === "not_found";
}

/** Reads the public endpoint's answer (docs/REFERENCIA.md, "Event registration") without trusting its shape. */
export function outcomeFromResponse(status: number, body: unknown, retryAfter: string | null): OpenOutcome {
  if (status === 201) return { kind: "registered" };

  const code = errorCode(body);

  if (status === 400 && code === "validation") {
    const field = body !== null && typeof body === "object" && "field" in body && typeof body.field === "string" ? body.field : "";

    return isOpenField(field) ? { kind: "field", field } : { kind: "failed" };
  }

  if (status === 429) return { kind: "rate_limited", retryAfterSeconds: retryAfterSeconds(retryAfter) };

  if (code === "captcha" || code === "unavailable" || code === "email_unavailable" || code === "email_budget" || code === "not_found") return { kind: code };
  if (status === 409 && (code === "duplicate" || code === "full" || code === "closed")) return { kind: code };

  return { kind: "failed" };
}

const MESSAGES = {
  duplicate: "Ya hay una inscripción con ese correo para este evento. No necesita hacer nada más.",
  full: "Ya no quedan cupos para este evento.",
  closed: "Las inscripciones de este evento ya cerraron.",
  not_found: "Este evento ya no recibe inscripciones desde aquí.",
  captcha: "No pudimos comprobar que usted es una persona. Complete la verificación e inténtelo de nuevo.",
  unavailable: "La inscripción no está disponible en este momento. Inténtelo de nuevo en unos minutos.",
  email_unavailable: "No pudimos enviarle el correo de confirmación en este momento. Inténtelo de nuevo en unos minutos.",
  email_budget: "Hoy ya enviamos todos los correos de confirmación que podemos. Inténtelo de nuevo mañana.",
  failed: "No pudimos enviar su inscripción. Revise su conexión e inténtelo de nuevo.",
} as const;

/** The widget could not even start (blocked script, no network): there is no token to send, now or later. */
export const CAPTCHA_LOAD_MESSAGE = "No pudimos cargar la verificación. Recargue la página e inténtelo de nuevo.";

/** Said instead of `MESSAGES.captcha` when the page showed no widget (no site key): there is no verification to complete. */
const CAPTCHA_WITHOUT_WIDGET = "No pudimos comprobar que usted es una persona. Inténtelo de nuevo en unos minutos.";

/**
 * The sentence for every outcome that is not a success and not tied to one field. `widget`: whether the page
 * shows the Turnstile check, which decides whether "complete the verification" is something the person can do.
 */
export function outcomeMessage(outcome: Exclude<OpenOutcome, { kind: "registered" | "field" }>, { widget = true }: { widget?: boolean } = {}): string {
  if (outcome.kind === "rate_limited") return `Hizo varios intentos seguidos. Vuelva a intentarlo en ${waitText(outcome.retryAfterSeconds)}.`;

  return outcome.kind === "captcha" && !widget ? CAPTCHA_WITHOUT_WIDGET : MESSAGES[outcome.kind];
}

/** Posts to the public endpoint of the event (same origin: no CORS) and never throws: a dead network is an outcome too. */
export function submitOpenRegistration(slug: string, payload: Record<string, unknown>, send: typeof fetch = fetch): Promise<OpenOutcome> {
  return postToRegistrationEndpoint(slug, "", payload, outcomeFromResponse, { kind: "failed" }, send);
}
