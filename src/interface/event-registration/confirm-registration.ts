/*
 * The browser half of the confirm page: it POSTs the token of the email link to the public confirm endpoint and turns
 * the answer into one outcome the page can show. The server still decides everything. No server-only imports: the
 * button is a client component.
 */

import { errorCode, postToRegistrationEndpoint, retryAfterSeconds, waitText } from "./registration-endpoint-answer";

export type ConfirmOutcome =
  | { kind: "confirmed" | "already_confirmed" | "full" | "closed" | "expired" | "invalid" | "not_found" | "unavailable" | "failed" }
  | { kind: "rate_limited"; retryAfterSeconds: number | null };

/** Reads the confirm endpoint's answer (docs/REFERENCIA.md, "Event registration") without trusting its shape. */
export function confirmOutcomeFromResponse(status: number, body: unknown, retryAfter: string | null): ConfirmOutcome {
  if (status === 200) {
    const result = body !== null && typeof body === "object" && "status" in body ? body.status : undefined;

    return result === "confirmed" || result === "already_confirmed" ? { kind: result } : { kind: "failed" };
  }

  if (status === 429) return { kind: "rate_limited", retryAfterSeconds: retryAfterSeconds(retryAfter) };

  const code = errorCode(body);

  if (code === "full" || code === "closed" || code === "expired" || code === "invalid" || code === "not_found" || code === "unavailable") return { kind: code };

  return { kind: "failed" };
}

export interface ConfirmMessage {
  title: string;
  detail: string;
  /** The seat is the person's: show it, with the calendar. */
  reserved: boolean;
  /** The link is no use any more: offer the way back to the form. */
  backToForm: boolean;
  /** Worth pressing the button again. */
  retry: boolean;
}

const NONE = { reserved: false, backToForm: false, retry: false } as const;

/** What the page says for each outcome, addressed as usted like the rest of the registration page. */
export function confirmOutcomeMessage(outcome: ConfirmOutcome): ConfirmMessage {
  switch (outcome.kind) {
    case "confirmed":
      return { ...NONE, title: "Listo, su cupo está reservado", detail: "Guarde la fecha y el lugar. Unos días antes del evento le enviaremos un recordatorio a este correo.", reserved: true };
    case "already_confirmed":
      return { ...NONE, title: "Su cupo ya estaba reservado", detail: "No necesita hacer nada más. Unos días antes del evento le enviaremos un recordatorio a este correo.", reserved: true };
    case "full":
      return { ...NONE, title: "Cupos agotados", detail: "Mientras usted confirmaba, los cupos de este evento se agotaron y no pudimos reservarle uno." };
    case "closed":
      return { ...NONE, title: "Las inscripciones cerraron", detail: "Las inscripciones de este evento cerraron antes de que usted confirmara, así que no se reservó su cupo." };
    case "expired":
      return { ...NONE, title: "Este enlace venció", detail: "El enlace vale 48 horas y ya pasó ese tiempo. Vuelva al formulario y pida uno nuevo.", backToForm: true };
    case "invalid":
      return { ...NONE, title: "Este enlace no sirve", detail: "El enlace está incompleto o no es de esta inscripción. Vuelva al formulario y pida uno nuevo.", backToForm: true };
    case "not_found":
      return { ...NONE, title: "Este evento ya no recibe inscripciones", detail: "El evento no está disponible en este momento." };
    case "rate_limited":
      return { ...NONE, title: "Demasiados intentos", detail: `Espere ${waitText(outcome.retryAfterSeconds)} antes de intentarlo de nuevo.`, retry: true };
    case "unavailable":
      return { ...NONE, title: "No pudimos confirmar su cupo", detail: "El servicio no está disponible en este momento. Inténtelo de nuevo en unos minutos.", retry: true };
    case "failed":
      return { ...NONE, title: "No pudimos confirmar su cupo", detail: "Revise su conexión e inténtelo de nuevo.", retry: true };
  }
}

/** Posts the token to the confirm endpoint of the event (same origin: no CORS) and never throws: a dead network is an outcome too. */
export function submitConfirmation(slug: string, token: string, send: typeof fetch = fetch): Promise<ConfirmOutcome> {
  return postToRegistrationEndpoint(slug, "/confirm", { token }, confirmOutcomeFromResponse, { kind: "failed" }, send);
}
