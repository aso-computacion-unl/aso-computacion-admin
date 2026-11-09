import { describe, expect, it } from "vitest";

import type { EventRegistrationRecord } from "@/application";
import { registrationsToCsv } from "@/interface/admin/event-registrations/registrations-csv";

const row = (overrides: Partial<EventRegistrationRecord> = {}): EventRegistrationRecord => ({
  id: "r1",
  eventId: "e1",
  mode: "open",
  name: "Ana Pérez",
  email: "ana@example.com",
  institution: "Universidad Nacional de Loja",
  career: "Computación",
  semester: 5,
  createdAt: new Date("2026-11-20T15:30:00.000Z"),
  confirmedAt: new Date("2026-11-20T15:30:00.000Z"),
  reminderSentAt: null,
  ...overrides,
});

const lines = (csv: string) => csv.replace(/^\uFEFF/, "").trimEnd().split("\r\n");

describe("registrationsToCsv", () => {
  it("starts with a byte order mark (so Excel reads the accents) and a Spanish header", () => {
    const csv = registrationsToCsv([]);

    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(lines(csv)[0]).toBe('"Nombre","Correo","Forma de inscripción","Institución","Carrera","Ciclo","Inscrito el (hora de Ecuador)"');
  });

  it("writes one quoted row per registration, with the time in Ecuador and empty cells for what the mode does not collect", () => {
    const csv = registrationsToCsv([row(), row({ id: "r2", mode: "unl", name: "Luis", email: "luis@unl.edu.ec", institution: null, career: null, semester: null })]);

    expect(lines(csv).slice(1)).toEqual([
      '"Ana Pérez","ana@example.com","Formulario abierto","Universidad Nacional de Loja","Computación","5","2026-11-20 10:30"',
      '"Luis","luis@unl.edu.ec","Cuenta UNL","","","","2026-11-20 10:30"',
    ]);
  });

  it("escapes quotes, commas and line breaks inside a cell", () => {
    const csv = registrationsToCsv([row({ name: 'Ana "la mejor", de Loja', career: "Línea 1\nLínea 2" })]);

    expect(csv).toContain('"Ana ""la mejor"", de Loja"');
    expect(csv).toContain('"Línea 1\nLínea 2"');
  });

  it.each(["=HYPERLINK(\"http://evil\")", "+1+1", "-2+3", "@SUM(A1)", "\tcmd", "\rcmd"])("neutralises a spreadsheet formula in %j", (name) => {
    expect(registrationsToCsv([row({ name })])).toContain(`"'${name.replaceAll('"', '""')}"`);
  });

  it("keeps the institution a person typed from running as a formula, like any other cell", () => {
    expect(registrationsToCsv([row({ institution: "=cmd|' /C calc'!A0" })])).toContain(`"'=cmd|' /C calc'!A0"`);
  });

  it("writes career and semester empty for a registration that left them out", () => {
    expect(lines(registrationsToCsv([row({ career: null, semester: null })]))[1]).toBe('"Ana Pérez","ana@example.com","Formulario abierto","Universidad Nacional de Loja","","","2026-11-20 10:30"');
  });

  it("leaves an ordinary name that merely contains those characters alone", () => {
    expect(registrationsToCsv([row({ name: "Ana-María O'Neil" })])).toContain('"Ana-María O\'Neil"');
  });
});
