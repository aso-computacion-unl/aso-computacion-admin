import { describe, expect, it } from "vitest";

import { mapActionError } from "@/interface/admin/action-result";
import { parseEventFormData } from "@/interface/admin/events/event-form-data";
import { EMPTY_EVENT_FORM_VALUES, eventToFormValues, formValuesToFormData } from "@/interface/admin/events/event-form-values";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries({ title: "Taller", ...fields })) data.set(key, value);
  return data;
}

describe("event form registration fields", () => {
  it("reads the mode, the capacity and the deadline (Ecuador time)", () => {
    expect(parseEventFormData(form({ registrationMode: "open", registrationCapacity: " 40 ", registrationDeadline: "2026-11-27T18:00" }))).toMatchObject({
      registrationMode: "open",
      registrationCapacity: 40,
      registrationDeadline: new Date("2026-11-27T23:00:00.000Z"),
    });
    expect(parseEventFormData(form({ registrationMode: "unl" }))).toMatchObject({ registrationMode: "unl" });
  });

  it("blank capacity and deadline clear them; absent keys leave them alone", () => {
    expect(parseEventFormData(form({ registrationMode: "open", registrationCapacity: "", registrationDeadline: "" }))).toMatchObject({
      registrationCapacity: null,
      registrationDeadline: null,
    });

    const untouched = parseEventFormData(form({}));

    expect(untouched.registrationMode).toBeUndefined();
    expect(untouched.registrationCapacity).toBeUndefined();
    expect(untouched.registrationDeadline).toBeUndefined();
  });

  it.each([
    ["registrationMode", { registrationMode: "both" }],
    ["registrationCapacity", { registrationCapacity: "many" }],
    ["registrationCapacity", { registrationCapacity: "2.5" }],
    ["registrationCapacity", { registrationCapacity: "-4" }],
    ["registrationDeadline", { registrationDeadline: "tomorrow" }],
  ])("refuses an invalid %s with a message for that field", (field, fields) => {
    let error: unknown;

    try {
      parseEventFormData(form(fields));
    } catch (caught) {
      error = caught;
    }

    expect(mapActionError(error).fieldErrors).toEqual({ [field]: expect.stringMatching(/\S/) });
    expect(mapActionError(error).fieldErrors?.[field]).not.toBe("El valor no es válido.");
  });

  it("shows a stored event's settings as text and round-trips them through the form", () => {
    const deadline = new Date("2026-11-27T23:00:00.000Z");
    const values = eventToFormValues({
      ...EMPTY_EVENT_FORM_VALUES,
      slug: "taller",
      description: null,
      type: null,
      commitMessage: null,
      hora: null,
      lugar: null,
      para: null,
      linkUrl: null,
      linkLabel: null,
      highlights: [],
      publishAt: null,
      unpublishAt: null,
      date: null,
      registrationMode: "unl",
      registrationCapacity: 25,
      registrationDeadline: deadline,
    });

    expect(values).toMatchObject({ registrationMode: "unl", registrationCapacity: "25", registrationDeadline: "2026-11-27T18:00" });
    expect(parseEventFormData(formValuesToFormData({ ...values, title: "Taller" }))).toMatchObject({
      registrationMode: "unl",
      registrationCapacity: 25,
      registrationDeadline: deadline,
    });
    expect(EMPTY_EVENT_FORM_VALUES).toMatchObject({ registrationMode: "none", registrationCapacity: "", registrationDeadline: "" });
  });
});
