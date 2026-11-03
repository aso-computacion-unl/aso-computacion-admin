import { describe, expect, it, vi } from "vitest";

import {
  OPEN_FIELDS,
  openPayload,
  outcomeFromResponse,
  outcomeMessage,
  submitOpenRegistration,
  validateOpenForm,
  type OpenFormValues,
} from "@/interface/event-registration/open-registration";

const VALID: OpenFormValues = { name: "Ana Pérez", email: "ana@example.com", career: "Computación", semester: "5" };

describe("validateOpenForm", () => {
  it("accepts what the server accepts", () => {
    expect(validateOpenForm(VALID)).toEqual({});
    expect(validateOpenForm({ ...VALID, name: "  Ana   Pérez  ", email: " ANA@Example.com " })).toEqual({});
  });

  it("names every empty field in Spanish, in the order of the form", () => {
    const errors = validateOpenForm({ name: "", email: "  ", career: "", semester: "" });

    expect(Object.keys(errors)).toEqual([...OPEN_FIELDS]);
    expect(errors.name).toBe("Escribe tu nombre.");
    expect(errors.email).toBe("Escribe tu correo.");
    expect(errors.career).toBe("Escribe tu carrera.");
    expect(errors.semester).toBe("Elige tu semestre, del 1 al 12.");
  });

  it("flags only the fields that are wrong", () => {
    expect(Object.keys(validateOpenForm({ ...VALID, email: "ana@" }))).toEqual(["email"]);
    expect(Object.keys(validateOpenForm({ ...VALID, semester: "13" }))).toEqual(["semester"]);
    expect(Object.keys(validateOpenForm({ ...VALID, semester: "0" }))).toEqual(["semester"]);
    expect(Object.keys(validateOpenForm({ ...VALID, name: "a".repeat(121), career: "b".repeat(121) }))).toEqual(["name", "career"]);
  });

  it("explains a filled but invalid field differently from an empty one", () => {
    expect(validateOpenForm({ ...VALID, email: "ana@" }).email).toBe("Revisa tu correo: no parece una dirección válida.");
    expect(validateOpenForm({ ...VALID, name: "a".repeat(121) }).name).toBe("Tu nombre es muy largo: usa hasta 120 caracteres.");
    expect(validateOpenForm({ ...VALID, name: "Ana\u0000" }).name).toBe("Tu nombre tiene caracteres que no podemos guardar.");
    expect(validateOpenForm({ ...VALID, career: "Compu\u0007tación" }).career).toBe("Tu carrera tiene caracteres que no podemos guardar.");
    expect(validateOpenForm({ ...VALID, name: "Ana \ud800" }).name).toBe("Tu nombre tiene caracteres que no podemos guardar.");
  });
});

describe("openPayload", () => {
  it("sends the four fields and the Turnstile token, with the semester as a number", () => {
    expect(openPayload(VALID, "tok")).toEqual({ name: "Ana Pérez", email: "ana@example.com", career: "Computación", semester: 5, turnstileToken: "tok" });
  });

  it("leaves the token out when there is no widget", () => {
    expect(openPayload(VALID, null)).not.toHaveProperty("turnstileToken");
  });
});

describe("outcomeFromResponse", () => {
  it.each([
    [201, { ok: true }, { kind: "registered" }],
    [400, { error: "validation", field: "semester" }, { kind: "field", field: "semester" }],
    [400, { error: "validation", field: "turnstile" }, { kind: "failed" }],
    [400, { error: "validation" }, { kind: "failed" }],
    [400, { error: "validation", field: 7 }, { kind: "failed" }],
    [400, { error: "captcha" }, { kind: "captcha" }],
    [400, { error: "bad_request" }, { kind: "failed" }],
    [404, { error: "not_found" }, { kind: "not_found" }],
    [409, { error: "duplicate" }, { kind: "duplicate" }],
    [409, { error: "full" }, { kind: "full" }],
    [409, { error: "closed" }, { kind: "closed" }],
    [413, { error: "too_large" }, { kind: "failed" }],
    [503, { error: "unavailable" }, { kind: "unavailable" }],
    [500, null, { kind: "failed" }],
    [502, "<html>", { kind: "failed" }],
  ])("reads %i %j as %j", (status, body, expected) => {
    expect(outcomeFromResponse(status, body, null)).toEqual(expected);
  });

  it("keeps how long to wait after a rate limit, and survives a missing or odd header", () => {
    expect(outcomeFromResponse(429, { error: "rate_limited" }, "120")).toEqual({ kind: "rate_limited", retryAfterSeconds: 120 });
    expect(outcomeFromResponse(429, { error: "rate_limited" }, null)).toEqual({ kind: "rate_limited", retryAfterSeconds: null });
    expect(outcomeFromResponse(429, { error: "rate_limited" }, "soon")).toEqual({ kind: "rate_limited", retryAfterSeconds: null });
  });
});

describe("outcomeMessage", () => {
  it("says every refusal in Spanish, to a student, without usted", () => {
    const kinds = ["duplicate", "full", "closed", "not_found", "captcha", "unavailable", "failed"] as const;

    for (const kind of kinds) {
      const message = outcomeMessage({ kind });

      expect(message.length).toBeGreaterThan(10);
      expect(message).not.toMatch(/\busted\b|\bsu\b|\bsus\b/i);
    }

    expect(outcomeMessage({ kind: "full" })).toBe("Ya no quedan cupos para este evento.");
    expect(outcomeMessage({ kind: "closed" })).toBe("Las inscripciones de este evento ya cerraron.");
    expect(outcomeMessage({ kind: "duplicate" })).toContain("Ya hay una inscripción con ese correo");
  });

  it("does not ask for a verification the page never showed: without the widget a captcha refusal is a plain retry", () => {
    expect(outcomeMessage({ kind: "captcha" })).toContain("Completa la verificación");
    expect(outcomeMessage({ kind: "captcha" }, { widget: false })).toBe("No pudimos comprobar que eres una persona. Inténtalo de nuevo en unos minutos.");
    expect(outcomeMessage({ kind: "duplicate" }, { widget: false })).toContain("Ya hay una inscripción");
  });

  it("tells how long to wait after a rate limit, in minutes once it is a minute or more", () => {
    expect(outcomeMessage({ kind: "rate_limited", retryAfterSeconds: 1 })).toContain("1 segundo.");
    expect(outcomeMessage({ kind: "rate_limited", retryAfterSeconds: 45 })).toContain("45 segundos");
    expect(outcomeMessage({ kind: "rate_limited", retryAfterSeconds: 61 })).toContain("2 minutos");
    expect(outcomeMessage({ kind: "rate_limited", retryAfterSeconds: 60 })).toContain("1 minuto.");
    expect(outcomeMessage({ kind: "rate_limited", retryAfterSeconds: null })).toContain("unos minutos");
  });
});

describe("submitOpenRegistration", () => {
  const payload = openPayload(VALID, "tok");

  it("posts the JSON to the public endpoint of the event, same origin, and reads the answer", async () => {
    const send = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 201 }));

    expect(await submitOpenRegistration("taller-de-git", payload, send)).toEqual({ kind: "registered" });
    expect(send).toHaveBeenCalledWith("/api/public/events/taller-de-git/registrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  });

  it("reads the Retry-After of a rate limit", async () => {
    const send = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "rate_limited" }), { status: 429, headers: { "Retry-After": "300" } }));

    expect(await submitOpenRegistration("x", payload, send)).toEqual({ kind: "rate_limited", retryAfterSeconds: 300 });
  });

  it("turns a dead network or a non-JSON answer into a plain failure instead of throwing", async () => {
    expect(await submitOpenRegistration("x", payload, vi.fn().mockRejectedValue(new TypeError("Failed to fetch")))).toEqual({ kind: "failed" });
    expect(await submitOpenRegistration("x", payload, vi.fn().mockResolvedValue(new Response("<html>", { status: 502 })))).toEqual({ kind: "failed" });
  });
});
