import type { RegistrationOverviewRow } from "@/application";

const WHEN = new Intl.DateTimeFormat("es-EC", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Guayaquil" });

export const MODE_LABELS = { unl: "Cuenta UNL", open: "Formulario abierto" } as const;
export const STATE_LABELS = { open: "Abierta", full: "Sin cupos", closed: "Cerrada" } as const;
/** A mark beside the word, so the state never rests on color alone: filled, square, hollow. */
export const STATE_MARKS = { open: "●", full: "■", closed: "○" } as const;
// A live event shows nothing: the note only says why an event with registrants is not on the landing right now.
export const NOT_PUBLIC_LABELS = { draft: "Borrador", scheduled: "Programado", expired: "Retirado" } as const;

export function formatWhen(date: Date): string {
  return WHEN.format(date);
}

export function seats({ registered, capacity }: RegistrationOverviewRow): string {
  return capacity === null ? `${registered} · sin límite` : `${registered} / ${capacity}`;
}

/** What a screen reader says for the seats: the slash and the dot are not words. */
export function seatsSpoken({ registered, capacity }: RegistrationOverviewRow): string {
  return capacity === null ? `${registered}, sin límite` : `${registered} de ${capacity}`;
}

/** When registration ends: the deadline, or what the event itself decides (its day, its month, or never when it has no date). */
export function closing(row: RegistrationOverviewRow): string {
  // "p. m." never breaks across two lines.
  if (row.deadline) return WHEN.format(row.deadline).replace(/\s([ap])\. m\./, "\u00a0$1.\u00a0m.");
  if (row.date === null) return "Sin cierre";

  return row.datePrecision === "month" ? "Al terminar el mes" : "Con el día del evento";
}

/** The event the screen opens on: the nearest upcoming one that still takes registrations, else the first of the list. */
export function defaultEvent(upcoming: RegistrationOverviewRow[], past: RegistrationOverviewRow[]): RegistrationOverviewRow | undefined {
  return upcoming.find((row) => row.state === "open") ?? upcoming[0] ?? past[0];
}
