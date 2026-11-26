import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { ImageTooLargeError, ValidationError } from "@/domain";
import { DEADLINE_AFTER_EVENT_MESSAGE, PAST_EVENT_REGISTRATION_MESSAGE } from "@/domain/event-registration";
import { mapActionError, resultText } from "@/interface/admin/action-result";

describe("resultText", () => {
  it("prefers the error over any field error", () => {
    expect(resultText({ error: "Falló", fieldErrors: { title: "Falta el título" } })).toBe("Falló");
  });

  it("falls back to the first field error", () => {
    expect(resultText({ fieldErrors: { title: "Falta el título", slug: "Slug inválido" } })).toBe("Falta el título");
  });

  it("falls back to the generic message when the result says nothing", () => {
    expect(resultText({})).toBe("Ocurrió un error inesperado. Intente nuevamente.");
    expect(resultText({ fieldErrors: {} })).toBe("Ocurrió un error inesperado. Intente nuevamente.");
  });
});

describe("mapActionError", () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it("explains an image over the size limit on the file field", () => {
    expect(mapActionError(new ImageTooLargeError("too big"))).toEqual({ fieldErrors: { file: "La imagen supera el máximo de 5 MB." } });
  });

  it("gives a field the domain rejected but has no catalogued text a generic message", () => {
    expect(mapActionError(new ValidationError("campo-desconocido", "invalid"))).toEqual({ fieldErrors: { "campo-desconocido": "El valor no es válido." } });
  });

  it("uses the catalogued text of a known field, or the override of an entity whose limits differ", () => {
    expect(mapActionError(new ValidationError("title", "invalid")).fieldErrors?.title).toMatch(/120 caracteres/);
    expect(mapActionError(new ValidationError("title", "invalid"), { title: "Hasta 60 caracteres." })).toEqual({ fieldErrors: { title: "Hasta 60 caracteres." } });
  });

  it("reports every field of an aggregated domain rejection, first message per field", () => {
    const error = ValidationError.fromIssues([
      { field: "slug", message: "slug is already used by another event" },
      { field: "linkLabel", message: "linkLabel needs a linkUrl" },
      { field: "unpublishAt", message: "unpublishAt must be after publishAt" },
      { field: "slug", message: "slug must be lowercase letters and digits separated by hyphens (at most 80 characters)" },
    ]);

    expect(mapActionError(error)).toEqual({
      fieldErrors: {
        slug: "El identificador solo admite minúsculas, números y guiones, y no puede repetirse.",
        linkLabel: "El texto del enlace admite hasta 80 caracteres y requiere un enlace.",
        unpublishAt: "La fecha de retiro debe ser posterior a la de publicación.",
      },
    });
    expect(mapActionError(ValidationError.fromIssues([{ field: "title", message: "x" }]), { title: "Hasta 60 caracteres." })).toEqual({ fieldErrors: { title: "Hasta 60 caracteres." } });
  });

  it("explains the registration date rules with their own text, not the field's", () => {
    const error = ValidationError.fromIssues([
      { field: "registrationMode", message: PAST_EVENT_REGISTRATION_MESSAGE },
      { field: "registrationDeadline", message: DEADLINE_AFTER_EVENT_MESSAGE },
    ]);

    expect(mapActionError(error)).toEqual({
      fieldErrors: {
        registrationMode: "El evento ya pasó: su inscripción no se puede abrir ni cambiar, solo desactivar.",
        registrationDeadline: "El cierre de la inscripción no puede ser posterior al día del evento.",
      },
    });
    expect(mapActionError(new ValidationError("registrationMode", "invalid")).fieldErrors?.registrationMode).toBe("Elija una forma de inscripción de la lista.");
  });

  it("maps a single domain rejection to exactly its one field and catalogued text", () => {
    expect(mapActionError(new ValidationError("slug", "slug is already used by another event"))).toEqual({
      fieldErrors: { slug: "El identificador solo admite minúsculas, números y guiones, y no puede repetirse." },
    });
  });

  it("reports a schema issue on the field it points at, with the schema's own message", () => {
    const parsed = z.object({ title: z.string().min(1, "Falta el título") }).safeParse({ title: "" });

    expect(parsed.success).toBe(false);
    expect(mapActionError(parsed.error)).toEqual({ fieldErrors: { title: "Falta el título" } });
  });

  it("reports every field a schema rejects, once each and in the schema's order", () => {
    const parsed = z.object({ title: z.string().min(1, "Falta el título"), summary: z.string().min(1, "Falta el resumen"), body: z.string().min(1, "Falta el texto"), slug: z.string() }).safeParse({ title: "", summary: "", body: "", slug: "x" });

    expect(mapActionError(parsed.error)).toEqual({
      fieldErrors: { title: "Falta el título", summary: "Falta el resumen", body: "Falta el texto" },
    });
  });

  it("keeps the first message of a field that fails twice", () => {
    const parsed = z.object({ title: z.string().min(2, "Muy corto").regex(/^a/, "Debe empezar con a") }).safeParse({ title: "" });

    expect(mapActionError(parsed.error)).toEqual({ fieldErrors: { title: "Muy corto" } });
  });

  it("reports a schema issue on the file field with the image format text, not the schema's", () => {
    const parsed = z.object({ file: z.string().min(1, "interno") }).safeParse({ file: "" });
    const result = mapActionError(parsed.error);

    expect(result.fieldErrors?.file).toBeDefined();
    expect(result.fieldErrors?.file).not.toBe("interno");
  });

  it("reports a schema issue with no path on the form", () => {
    const parsed = z.string().min(1, "Vacío").safeParse("");

    expect(mapActionError(parsed.error)).toEqual({ fieldErrors: { form: "Vacío" } });
  });

  it("reports fields the form should not carry as a form error", () => {
    const parsed = z.object({ title: z.string() }).strict().safeParse({ title: "x", extra: 1 });

    expect(mapActionError(parsed.error)).toEqual({ fieldErrors: { form: "El formulario incluye campos no admitidos." } });
  });

  it("reduces an unknown failure to the generic message without leaking it", () => {
    const result = mapActionError(new Error("connection string postgres://secret"));

    expect(result).toEqual({ error: "Ocurrió un error inesperado. Intente nuevamente." });
    expect(consoleError).toHaveBeenCalled();
  });
});
