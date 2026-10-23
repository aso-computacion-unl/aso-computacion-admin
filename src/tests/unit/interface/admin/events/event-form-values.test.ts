import { describe, expect, it } from "vitest";

import { EMPTY_EVENT_FORM_VALUES, eventToFormValues, formValuesToFormData } from "@/interface/admin/events/event-form-values";
import { parseEventFormData } from "@/interface/admin/events/event-form-data";

describe("event form values", () => {
  it("starts empty and unpublished", () => {
    expect(EMPTY_EVENT_FORM_VALUES).toMatchObject({ title: "", featured: false, isPublished: false, highlights: "", datePrecision: "day" });
  });

  it("turns a stored event into editable text, one highlight per line", () => {
    const values = eventToFormValues({
      slug: "hackaton",
      title: "Hackatón",
      description: null,
      date: "2026-11-28",
      datePrecision: "day",
      type: "evento",
      commitMessage: "feat: hackatón",
      hora: null,
      lugar: "Lab 2",
      para: null,
      featured: true,
      linkUrl: "https://aso.test",
      linkLabel: "Inscribirme",
      highlights: ["Apertura", "Retos"],
      isPublished: true,
    });

    expect(values).toEqual({
      slug: "hackaton",
      title: "Hackatón",
      description: "",
      date: "2026-11-28",
      datePrecision: "day",
      type: "evento",
      commitMessage: "feat: hackatón",
      hora: "",
      lugar: "Lab 2",
      para: "",
      featured: true,
      linkUrl: "https://aso.test",
      linkLabel: "Inscribirme",
      highlights: "Apertura\nRetos",
      isPublished: true,
    });
  });

  it("round-trips through FormData and the server-side parser without losing a field", () => {
    const values = { ...EMPTY_EVENT_FORM_VALUES, title: "Charla", featured: true, highlights: "Uno\nDos", type: "charla" };

    expect(parseEventFormData(formValuesToFormData(values))).toMatchObject({
      title: "Charla",
      featured: true,
      isPublished: false,
      highlights: ["Uno", "Dos"],
      type: "charla",
      slug: undefined,
    });
  });

  it("round-trips a month-only date through the form", () => {
    const stored = { ...EMPTY_EVENT_FORM_VALUES, title: "Semana", date: "2026-02-01", datePrecision: "month" as const };
    const parsed = parseEventFormData(formValuesToFormData(stored));

    expect(parsed).toMatchObject({ date: "2026-02-01", datePrecision: "month" });
    expect(eventToFormValues({ ...stored, slug: "semana", description: null, type: null, commitMessage: null, hora: null, lugar: null, para: null, linkUrl: null, linkLabel: null, highlights: [], isPublished: false }))
      .toMatchObject({ date: "2026-02-01", datePrecision: "month" });
  });

  it("reads a form without the precision as an exact date, and rejects an unknown one", () => {
    const withoutPrecision = formValuesToFormData(EMPTY_EVENT_FORM_VALUES);
    withoutPrecision.set("title", "Charla");
    withoutPrecision.delete("datePrecision");

    expect(parseEventFormData(withoutPrecision)).toMatchObject({ datePrecision: "day" });

    withoutPrecision.set("datePrecision", "week");
    expect(() => parseEventFormData(withoutPrecision)).toThrow();
  });

  it("keeps what the owner typed even when it is invalid, so a failed save never empties the form", () => {
    const typed = { ...EMPTY_EVENT_FORM_VALUES, title: "x".repeat(130), linkUrl: "http://nope" };

    const data = formValuesToFormData(typed);

    expect(data.get("title")).toBe(typed.title);
    expect(data.get("linkUrl")).toBe("http://nope");
  });
});
