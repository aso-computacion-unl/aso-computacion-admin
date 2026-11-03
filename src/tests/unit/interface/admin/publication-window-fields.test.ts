import { describe, expect, it } from "vitest";
import { z } from "zod";

import { EMPTY_EVENT_FORM_VALUES, eventToFormValues, formValuesToFormData } from "@/interface/admin/events/event-form-values";
import { parseEventFormData } from "@/interface/admin/events/event-form-data";
import { parseNewsFormData } from "@/interface/admin/news/news-form-data";
import { mapActionError } from "@/interface/admin/action-result";
import { ValidationError } from "@/domain";
import { publicationWindowFields } from "@/interface/admin/publication-window-fields";

const schema = z.object(publicationWindowFields);
const NEWS = { title: "Noticia", summary: "Resumen", body: "Cuerpo" };

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe("publication window form fields", () => {
  it("reads a datetime-local value as Ecuador time (UTC-5), trimmed", () => {
    expect(schema.parse({ publishAt: " 2026-11-02T08:00 ", unpublishAt: "2026-11-09T20:30" })).toEqual({
      publishAt: new Date("2026-11-02T13:00:00.000Z"),
      unpublishAt: new Date("2026-11-10T01:30:00.000Z"),
    });
  });

  it("blank clears the end (null) and an absent key keeps it (undefined)", () => {
    expect(schema.parse({ publishAt: "  ", unpublishAt: "" })).toEqual({ publishAt: null, unpublishAt: null });
    expect(schema.parse({})).toEqual({});
  });

  it("refuses a value that is not a real date-time, naming the field", () => {
    for (const value of ["tomorrow", "2026-11-02", "2026-02-30T08:00", "2026-11-02T25:00"]) {
      const result = schema.safeParse({ publishAt: value });

      expect(result.success, value).toBe(false);
      expect(result.error?.issues[0]).toMatchObject({ path: ["publishAt"], message: "Indique una fecha y hora válidas." });
    }
  });
});

describe("event form", () => {
  it("round-trips the window through the form in Ecuador time, whatever the process time zone", () => {
    const stored = { ...EMPTY_EVENT_FORM_VALUES, title: "Taller", publishAt: "2026-11-02T20:30", unpublishAt: "2026-11-09T08:00" };
    const parsed = parseEventFormData(formValuesToFormData(stored));

    expect(parsed).toMatchObject({ publishAt: new Date("2026-11-03T01:30:00.000Z"), unpublishAt: new Date("2026-11-09T13:00:00.000Z") });
    expect(
      eventToFormValues({ ...parsed, description: null, type: null, commitMessage: null, hora: null, lugar: null, para: null, linkUrl: null, linkLabel: null, slug: "taller" } as never),
    ).toMatchObject({ publishAt: "2026-11-02T20:30", unpublishAt: "2026-11-09T08:00" });
  });

  it("starts with an empty window and clears it when the fields are blank", () => {
    expect(EMPTY_EVENT_FORM_VALUES).toMatchObject({ publishAt: "", unpublishAt: "" });
    expect(parseEventFormData(formValuesToFormData({ ...EMPTY_EVENT_FORM_VALUES, title: "Taller" }))).toMatchObject({ publishAt: null, unpublishAt: null });
  });

  it("leaves the window alone when a form does not send it at all", () => {
    const data = formValuesToFormData({ ...EMPTY_EVENT_FORM_VALUES, title: "Taller" });
    data.delete("publishAt");
    data.delete("unpublishAt");

    expect(parseEventFormData(data)).not.toHaveProperty("publishAt", null);
    expect(parseEventFormData(data).publishAt).toBeUndefined();
  });
});

describe("news form", () => {
  it("reads the window, blank as cleared and absent as untouched", () => {
    expect(parseNewsFormData(form({ ...NEWS, publishAt: "2026-11-02T08:00", unpublishAt: "" }))).toMatchObject({
      publishAt: new Date("2026-11-02T13:00:00.000Z"),
      unpublishAt: null,
    });
    expect(parseNewsFormData(form(NEWS)).publishAt).toBeUndefined();
  });
});

describe("window errors", () => {
  it("tell the editor in Spanish which field is wrong", () => {
    expect(mapActionError(new ValidationError("unpublishAt", "unpublishAt must be after publishAt"))).toEqual({
      fieldErrors: { unpublishAt: "La fecha de retiro debe ser posterior a la de publicación." },
    });
    expect(mapActionError(new ValidationError("publishAt", "x"))).toEqual({ fieldErrors: { publishAt: "Indique una fecha y hora válidas." } });
  });
});
