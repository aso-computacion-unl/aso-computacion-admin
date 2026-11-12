/*
 * The browser half of the cancellation page (D7): it POSTs the token of the email link to the public cancel endpoint
 * and turns the answer into one outcome the page can show. The server still decides everything. No server-only
 * imports: the button is a client component.
 */

import { errorCode, postToRegistrationEndpoint, retryAfterSeconds, waitText } from "./registration-endpoint-answer";

export type CancelOutcome =
  | { kind: "cancelled" | "already_cancelled" | "closed" | "expired" | "invalid" | "not_found" | "unavailable" | "failed" }
  | { kind: "rate_limited"; retryAfterSeconds: number | null };

/** Reads the cancel endpoint's answer (docs/REFERENCIA.md, "Event registration") without trusting its shape. */
export function cancelOutcomeFromResponse(status: number, body: unknown, retryAfter: string | null): CancelOutcome {
  if (status === 200) {
    const result = body !== null && typeof body === "object" && "status" in body ? body.status : undefined;

    return result === "cancelled" || result === "already_cancelled" ? { kind: result } : { kind: "failed" };
  }

  if (status === 429) return { kind: "rate_limited", retryAfterSeconds: retryAfterSeconds(retryAfter) };

  const code = errorCode(body);

  if (code === "closed" || code === "expired" || code === "invalid" || code === "not_found" || code === "unavailable") return { kind: code };

  return { kind: "failed" };
}

export interface CancelMessage {
  title: string;
  detail: string;
  /** The person can still act on the event page (register again, read it): offer the way back. */
  backToEvent: boolean;
  /** Worth pressing the button again. */
  retry: boolean;
}

const DONE = { backToEvent: true, retry: false } as const;
const WRITE_TO_THE_BOARD = "Si no podrá asistir, escriba a la directiva de ASO.";

/** What the page says for each outcome, addressed as usted like the rest of the registration page. */
export function cancelOutcomeMessage(outcome: CancelOutcome): CancelMessage {
  switch (outcome.kind) {
    case "cancelled":
      return { ...DONE, title: "Su inscripción quedó cancelada", detail: "Liberamos su cupo y borramos sus datos de este evento. Si cambia de idea, puede volver a inscribirse mientras queden cupos." };
    case "already_cancelled":
      return { ...DONE, title: "Su inscripción ya estaba cancelada", detail: "No necesita hacer nada más." };
    case "closed":
      return { ...DONE, title: "Las inscripciones de este evento ya cerraron", detail: `Por eso ya no se puede cancelar desde aquí. ${WRITE_TO_THE_BOARD}` };
    case "expired":
      return { ...DONE, title: "Este enlace venció", detail: `El enlace ya no sirve para cancelar. ${WRITE_TO_THE_BOARD}` };
    case "invalid":
      return { ...DONE, title: "Este enlace no sirve", detail: "El enlace está incompleto o no es de esta inscripción." };
    case "not_found":
      return { backToEvent: false, retry: false, title: "Este evento ya no está disponible", detail: `No hay nada que cancelar aquí. ${WRITE_TO_THE_BOARD}` };
    case "rate_limited":
      return { backToEvent: false, retry: true, title: "Demasiados intentos", detail: `Espere ${waitText(outcome.retryAfterSeconds)} antes de intentarlo de nuevo.` };
    case "unavailable":
      return { backToEvent: false, retry: true, title: "No pudimos cancelar su inscripción", detail: "El servicio no está disponible en este momento. Inténtelo de nuevo en unos minutos." };
    case "failed":
      return { backToEvent: false, retry: true, title: "No pudimos cancelar su inscripción", detail: "Revise su conexión e inténtelo de nuevo." };
  }
}

/** Posts the token to the cancel endpoint of the event (same origin: no CORS) and never throws: a dead network is an outcome too. */
export function submitCancellation(slug: string, token: string, send: typeof fetch = fetch): Promise<CancelOutcome> {
  return postToRegistrationEndpoint(slug, "/cancel", { token }, cancelOutcomeFromResponse, { kind: "failed" }, send);
}
