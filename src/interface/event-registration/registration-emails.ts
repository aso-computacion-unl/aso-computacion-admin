/*
 * The emails of the registration flow, in Spanish and addressed as usted like the rest of the site. They are built
 * from the event's own data and our own links only: nothing the registrant typed ends up in a message that leaves
 * under the association's name, so a stranger's address cannot be made to carry text of someone else's choosing.
 * No server-only imports: plain functions over plain data.
 */

import type { MailMessage } from "@/application";

/** The slice of an event the emails speak about. */
export interface EmailEvent {
  slug: string;
  title: string;
  date: string | null;
  datePrecision: "day" | "month";
  hora: string | null;
  lugar: string | null;
}

export type EmailBody = Pick<MailMessage, "subject" | "text" | "html">;

const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"] as const;
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"] as const;
const SIGNATURE = "ASO Computación";

/** "sábado 28 de noviembre de 2026, 09:00 - 11:00", "noviembre de 2026" for a month-only event, "fecha por definir" without a date. */
export function eventWhen(event: Pick<EmailEvent, "date" | "datePrecision" | "hora">): string {
  const match = event.date === null ? null : /^(\d{4})-(\d{2})-(\d{2})$/.exec(event.date);
  const month = match ? MONTHS[Number(match[2]) - 1] : undefined;

  if (!match || !month) return "fecha por definir";

  if (event.datePrecision === "month") return `${month} de ${match[1]}`;

  const weekday = WEEKDAYS[new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))).getUTCDay()]!;
  const day = `${weekday} ${Number(match[3])} de ${month} de ${match[1]}`;

  return event.hora ? `${day}, ${event.hora}` : day;
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

/** The what/when/where lines shared by every email about an event. */
export function eventFacts(event: EmailEvent): string[] {
  return [`Evento: ${event.title}`, `Cuándo: ${eventWhen(event)}`, ...(event.lugar ? [`Lugar: ${event.lugar}`] : [])];
}

/** The HTML twin of `eventFacts`: same lines, escaped, one paragraph. */
export function eventFactsHtml(event: EmailEvent): string {
  return `<p>${eventFacts(event).map(escapeHtml).join("<br>")}</p>`;
}

export function emailHtml(paragraphs: string[]): string {
  return `<!doctype html><html lang="es"><body style="font-family:Arial,Helvetica,sans-serif;line-height:1.5;color:#111">${paragraphs.join("")}<p>${SIGNATURE}</p></body></html>`;
}

export { escapeHtml };

/** The line that offers the cancellation link (D7): what it does, so a person who cannot come lets the seat go. */
const CANCEL_LINE = "Si más adelante no puede asistir, cancele su inscripción y libere su cupo en este enlace:";

/** The email that carries the link which reserves the seat, and the one that cancels the registration (D7). */
export function confirmationEmail({ event, confirmUrl, cancelUrl }: { event: EmailEvent; confirmUrl: string; cancelUrl: string }): EmailBody {
  const text = [
    "Hola:",
    "",
    "Recibimos una solicitud para inscribir este correo en el siguiente evento.",
    "",
    ...eventFacts(event),
    "",
    "Para reservar su cupo, confirme su correo en este enlace (vale 48 horas):",
    confirmUrl,
    "",
    "El cupo solo cuenta cuando usted confirma. Si el evento se llena o cierra antes, el enlace se lo dirá.",
    "Si usted no pidió esta inscripción, ignore este mensaje: no se reservará nada.",
    "",
    CANCEL_LINE,
    cancelUrl,
    "",
    SIGNATURE,
  ].join("\n");
  const href = escapeHtml(confirmUrl);
  const cancelHref = escapeHtml(cancelUrl);

  return {
    subject: `Confirme su cupo en «${event.title}»`,
    text,
    html: emailHtml([
      "<p>Hola:</p>",
      "<p>Recibimos una solicitud para inscribir este correo en el siguiente evento.</p>",
      eventFactsHtml(event),
      `<p>Para reservar su cupo, confirme su correo en este enlace (vale 48 horas):<br><a href="${href}">${href}</a></p>`,
      "<p>El cupo solo cuenta cuando usted confirma. Si el evento se llena o cierra antes, el enlace se lo dirá.</p>",
      "<p>Si usted no pidió esta inscripción, ignore este mensaje: no se reservará nada.</p>",
      `<p>${CANCEL_LINE}<br><a href="${cancelHref}">${cancelHref}</a></p>`,
    ]),
  };
}

/**
 * The reminder a few days before the event: what, when and where, the event page and, when there is one, the calendar
 * file and the link that cancels this person's registration (D7). Without that link (the signing secret is missing) it
 * says what it always did: nothing to do.
 */
export function reminderEmail({ event, eventUrl, calendarUrl, cancelUrl = null }: { event: EmailEvent; eventUrl: string; calendarUrl: string | null; cancelUrl?: string | null }): EmailBody {
  const text = [
    "Hola:",
    "",
    "Le recordamos que usted está inscrito en el siguiente evento.",
    "",
    ...eventFacts(event),
    "",
    `Detalles del evento: ${eventUrl}`,
    ...(calendarUrl ? [`Añadir al calendario: ${calendarUrl}`] : []),
    "",
    ...(cancelUrl ? ["Si ya no puede asistir, cancele su inscripción y libere su cupo en este enlace:", cancelUrl] : ["Si ya no puede asistir, no necesita hacer nada más."]),
    "",
    SIGNATURE,
  ].join("\n");
  const link = (url: string) => `<a href="${escapeHtml(url)}">${escapeHtml(url)}</a>`;

  return {
    subject: `Recordatorio: «${event.title}», ${eventWhen({ ...event, hora: null })}`,
    text,
    html: emailHtml([
      "<p>Hola:</p>",
      "<p>Le recordamos que usted está inscrito en el siguiente evento.</p>",
      eventFactsHtml(event),
      `<p>Detalles del evento: ${link(eventUrl)}${calendarUrl ? `<br>Añadir al calendario: ${link(calendarUrl)}` : ""}</p>`,
      cancelUrl
        ? `<p>Si ya no puede asistir, cancele su inscripción y libere su cupo en este enlace:<br>${link(cancelUrl)}</p>`
        : "<p>Si ya no puede asistir, no necesita hacer nada más.</p>",
    ]),
  };
}
