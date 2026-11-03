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
  REGISTRATION_NAME_MAX_LENGTH,
  REGISTRATION_SEMESTER_MAX,
} from "@/domain/event-registration";

export const OPEN_FIELDS = ["name", "email", "career", "semester"] as const;
export type OpenField = (typeof OPEN_FIELDS)[number];
export type OpenFormValues = Record<OpenField, string>;
export type OpenFieldErrors = Partial<Record<OpenField, string>>;

// A value each field accepts, swapped in for one that failed so the next field can be checked in the same pass.
const ACCEPTED: OpenFormValues = { name: "x", email: "x@x.co", career: "x", semester: "1" };

const EMPTY_MESSAGES: Record<OpenField, string> = {
  name: "Escribe tu nombre.",
  email: "Escribe tu correo.",
  career: "Escribe tu carrera.",
  semester: `Elige tu semestre, del 1 al ${REGISTRATION_SEMESTER_MAX}.`,
};

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/;

/** What is wrong with a field the server (or the domain) refused, said for a student. */
export function fieldMessage(field: OpenField, value: string): string {
  const text = value.trim().replace(/\s+/g, " ");

  if (text === "") return EMPTY_MESSAGES[field];

  switch (field) {
    case "name":
      return CONTROL_CHARACTERS.test(text) ? "Tu nombre tiene caracteres que no podemos guardar." : `Tu nombre es muy largo: usa hasta ${REGISTRATION_NAME_MAX_LENGTH} caracteres.`;
    case "career":
      return CONTROL_CHARACTERS.test(text) ? "Tu carrera tiene caracteres que no podemos guardar." : `Tu carrera es muy larga: usa hasta ${REGISTRATION_CAREER_MAX_LENGTH} caracteres.`;
    case "email":
      return "Revisa tu correo: no parece una dirección válida.";
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
    career: values.career,
    semester: Number(values.semester),
    ...(turnstileToken ? { turnstileToken } : {}),
  };
}

export type OpenOutcome =
  | { kind: "registered" }
  | { kind: "field"; field: OpenField }
  | { kind: "duplicate" | "full" | "closed" | "not_found" | "captcha" | "unavailable" | "failed" }
  | { kind: "rate_limited"; retryAfterSeconds: number | null };

/** Refusals after which this page has nothing left to offer the person: the form gives way to the state. */
export function endsRegistration(outcome: OpenOutcome): outcome is { kind: "full" | "closed" | "not_found" } {
  return outcome.kind === "full" || outcome.kind === "closed" || outcome.kind === "not_found";
}

function errorCode(body: unknown): string | undefined {
  return body !== null && typeof body === "object" && "error" in body && typeof body.error === "string" ? body.error : undefined;
}

/** Reads the public endpoint's answer (docs/REFERENCIA.md, "Event registration") without trusting its shape. */
export function outcomeFromResponse(status: number, body: unknown, retryAfter: string | null): OpenOutcome {
  if (status === 201) return { kind: "registered" };

  const code = errorCode(body);

  if (status === 400 && code === "validation") {
    const field = body !== null && typeof body === "object" && "field" in body && typeof body.field === "string" ? body.field : "";

    return isOpenField(field) ? { kind: "field", field } : { kind: "failed" };
  }

  if (status === 429) {
    const seconds = Number(retryAfter);

    return { kind: "rate_limited", retryAfterSeconds: retryAfter && Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : null };
  }

  if (code === "captcha" || code === "unavailable" || code === "not_found") return { kind: code };
  if (status === 409 && (code === "duplicate" || code === "full" || code === "closed")) return { kind: code };

  return { kind: "failed" };
}

function waitText(seconds: number | null): string {
  if (seconds === null) return "unos minutos";
  if (seconds < 60) return `${seconds} ${seconds === 1 ? "segundo" : "segundos"}`;

  const minutes = Math.ceil(seconds / 60);

  return `${minutes} ${minutes === 1 ? "minuto" : "minutos"}`;
}

const MESSAGES = {
  duplicate: "Ya hay una inscripción con ese correo para este evento. No necesitas hacer nada más.",
  full: "Ya no quedan cupos para este evento.",
  closed: "Las inscripciones de este evento ya cerraron.",
  not_found: "Este evento ya no recibe inscripciones desde aquí.",
  captcha: "No pudimos comprobar que eres una persona. Completa la verificación e inténtalo de nuevo.",
  unavailable: "La inscripción no está disponible en este momento. Inténtalo de nuevo en unos minutos.",
  failed: "No pudimos enviar tu inscripción. Revisa tu conexión e inténtalo de nuevo.",
} as const;

/** The widget could not even start (blocked script, no network): there is no token to send, now or later. */
export const CAPTCHA_LOAD_MESSAGE = "No pudimos cargar la verificación. Recarga la página e inténtalo de nuevo.";

/** The sentence for every outcome that is not a success and not tied to one field. */
export function outcomeMessage(outcome: Exclude<OpenOutcome, { kind: "registered" | "field" }>): string {
  return outcome.kind === "rate_limited" ? `Hiciste varios intentos seguidos. Vuelve a intentarlo en ${waitText(outcome.retryAfterSeconds)}.` : MESSAGES[outcome.kind];
}

/** Posts to the public endpoint of the event (same origin: no CORS) and never throws: a dead network is an outcome too. */
export async function submitOpenRegistration(slug: string, payload: Record<string, unknown>, send: typeof fetch = fetch): Promise<OpenOutcome> {
  try {
    const response = await send(`/api/public/events/${encodeURIComponent(slug)}/registrations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body: unknown = await response.json().catch(() => null);

    return outcomeFromResponse(response.status, body, response.headers.get("Retry-After"));
  } catch {
    return { kind: "failed" };
  }
}
