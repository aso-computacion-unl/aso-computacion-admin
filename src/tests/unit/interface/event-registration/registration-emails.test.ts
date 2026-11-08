import { describe, expect, it } from "vitest";

import { confirmationEmail, eventWhen, type EmailEvent } from "@/interface/event-registration/registration-emails";

const EVENT: EmailEvent = { slug: "taller-de-git", title: "Taller de Git", date: "2026-11-28", datePrecision: "day", hora: "09:00 - 11:00", lugar: "Laboratorio 2" };
const LINK = "https://admin.example.org/inscripciones/taller-de-git/confirmar?token=abc.def.ghi";

describe("eventWhen", () => {
  it("writes the day in full Spanish with the time as the event says it", () => {
    expect(eventWhen(EVENT)).toBe("sábado 28 de noviembre de 2026, 09:00 - 11:00");
    expect(eventWhen({ ...EVENT, hora: null })).toBe("sábado 28 de noviembre de 2026");
    expect(eventWhen({ ...EVENT, date: "2027-01-01" })).toBe("viernes 1 de enero de 2027, 09:00 - 11:00");
  });

  it("is honest about an event without an exact day", () => {
    expect(eventWhen({ ...EVENT, datePrecision: "month", hora: null })).toBe("noviembre de 2026");
    expect(eventWhen({ ...EVENT, date: null })).toBe("fecha por definir");
  });
});

describe("confirmationEmail", () => {
  const mail = confirmationEmail({ event: EVENT, confirmUrl: LINK });

  it("names the event in the subject and carries the link once, in text and in HTML", () => {
    expect(mail.subject).toBe("Confirme su cupo en «Taller de Git»");
    expect(mail.text.split(LINK)).toHaveLength(2);
    expect(mail.html?.split(`href="${LINK}"`)).toHaveLength(2);
  });

  it("says what, when and where, how long the link lives, and that nothing is reserved until it is used", () => {
    expect(mail.text).toContain("Taller de Git");
    expect(mail.text).toContain("sábado 28 de noviembre de 2026, 09:00 - 11:00");
    expect(mail.text).toContain("Laboratorio 2");
    expect(mail.text).toContain("48 horas");
    expect(mail.text).toMatch(/hasta que (no )?confirme|solo cuenta cuando/i);
    expect(mail.text).toMatch(/si usted no (pidió|solicitó)/i);
  });

  it("speaks to the reader as usted, never tú", () => {
    expect(mail.text).not.toMatch(/\b(tu|tus|tú|revisa|guarda|ignora|haz|pulsa)\b/i);
    expect(mail.text).toMatch(/\busted\b/i);
  });

  it("escapes the event's text in the HTML and leaves out the place when there is none", () => {
    const tricky = confirmationEmail({ event: { ...EVENT, title: "<b>Git</b> & \"co\"", lugar: null }, confirmUrl: LINK });

    expect(tricky.html).toContain("&lt;b&gt;Git&lt;/b&gt; &amp; &quot;co&quot;");
    expect(tricky.html).not.toContain("<b>Git</b>");
    expect(tricky.text).not.toContain("Lugar");
    expect(tricky.subject).toBe("Confirme su cupo en «<b>Git</b> & \"co\"»");
  });
});
