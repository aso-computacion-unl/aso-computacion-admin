import type { EventRegistrationRecord } from "@/application";
import { formatEcuadorDateTime } from "@/domain/calendar-date";

const HEADER = ["Nombre", "Correo", "Forma de inscripción", "Carrera", "Ciclo", "Inscrito el (hora de Ecuador)"];
const MODE_LABELS = { unl: "Cuenta UNL", open: "Formulario abierto" } as const;

/** A cell a spreadsheet would run as a formula (`=`, `+`, `-`, `@`, tab, CR) gets a leading `'`, which shows as plain text. */
const FORMULA_START = /^[=+\-@\t\r]/;

function cell(value: string): string {
  const safe = FORMULA_START.test(value) ? `'${value}` : value;

  return `"${safe.replaceAll('"', '""')}"`;
}

/**
 * The registrations as a CSV for a spreadsheet: UTF-8 with a byte order mark (Excel needs it for accents),
 * every cell quoted, CRLF line ends, and nothing a spreadsheet could execute. Personal data: the caller decides who may get it.
 */
export function registrationsToCsv(registrations: readonly EventRegistrationRecord[]): string {
  const rows = registrations.map((registration) => [
    registration.name,
    registration.email,
    MODE_LABELS[registration.mode],
    registration.career ?? "",
    registration.semester === null ? "" : String(registration.semester),
    formatEcuadorDateTime(registration.createdAt).replace("T", " "),
  ]);

  return `\uFEFF${[HEADER, ...rows].map((row) => row.map(cell).join(",")).join("\r\n")}\r\n`;
}
