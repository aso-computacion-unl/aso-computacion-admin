import { describe, expect, it, vi } from "vitest";

import { toEventResult } from "@/application/mappers/event-result.mapper";

import { EMPTY_EVENT_FORM_VALUES, eventToFormValues, formValuesToFormData } from "@/interface/admin/events/event-form-values";
import { parseEventFormData } from "@/interface/admin/events/event-form-data";
import { storedEvent } from "@/tests/support/test-event-registration";

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
      publishAt: null,
      unpublishAt: null,
      registrationMode: "none",
      registrationCapacity: null,
      registrationDeadline: null,
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
      publishAt: "",
      unpublishAt: "",
    });
  });

  it("has no registration settings (S3): the event form never shows or sends them, only Inscripciones does", () => {
    const values = eventToFormValues(toEventResult(storedEvent({ title: "Taller", date: "2099-11-28", registrationMode: "open", registrationCapacity: 40 })));
    const keys = ["registrationMode", "registrationCapacity", "registrationDeadline"];

    for (const key of keys) {
      expect(values).not.toHaveProperty(key);
      expect(EMPTY_EVENT_FORM_VALUES).not.toHaveProperty(key);
      expect(formValuesToFormData(values).has(key)).toBe(false);
    }
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
    expect(eventToFormValues({ ...stored, slug: "semana", description: null, type: null, commitMessage: null, hora: null, lugar: null, para: null, linkUrl: null, linkLabel: null, highlights: [], isPublished: false, publishAt: null, unpublishAt: null, registrationMode: "none" as const, registrationCapacity: null, registrationDeadline: null }))
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

  it("saves a title change of a past event whose stored deadline carries seconds the form cannot show", () => {
    vi.useFakeTimers({ now: new Date("2026-11-20T15:00:00.000Z"), toFake: ["Date"] });

    try {
      const event = storedEvent({ title: "Taller", date: "2026-11-10", registrationMode: "open", registrationCapacity: 10, registrationDeadline: new Date("2026-11-09T18:30:12.345Z") });
      const values = { ...eventToFormValues(toEventResult(event)), title: "Taller pasado" };

      expect(event.update(parseEventFormData(formValuesToFormData(values))).props.title).toBe("Taller pasado");
    } finally {
      vi.useRealTimers();
    }
  });
});
