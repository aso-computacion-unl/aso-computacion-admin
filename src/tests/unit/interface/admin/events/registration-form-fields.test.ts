import { describe, expect, it } from "vitest";

import { mapActionError } from "@/interface/admin/action-result";
import { parseEventFormData } from "@/interface/admin/events/event-form-data";
import { parseRegistrationFormData } from "@/interface/admin/events/registration-form-fields";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe("registration form fields", () => {
  it("reads the mode, the capacity and the deadline (Ecuador time)", () => {
    expect(parseRegistrationFormData(form({ registrationMode: "open", registrationCapacity: " 40 ", registrationDeadline: "2026-11-27T18:00" }))).toEqual({
      registrationMode: "open",
      registrationCapacity: 40,
      registrationDeadline: new Date("2026-11-27T23:00:00.000Z"),
    });
    expect(parseRegistrationFormData(form({ registrationMode: "unl" }))).toEqual({ registrationMode: "unl" });
  });

  it("blank capacity and deadline clear them; absent keys leave them alone", () => {
    expect(parseRegistrationFormData(form({ registrationMode: "open", registrationCapacity: "", registrationDeadline: "" }))).toMatchObject({
      registrationCapacity: null,
      registrationDeadline: null,
    });

    const untouched = parseRegistrationFormData(form({}));

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
      parseRegistrationFormData(form(fields));
    } catch (caught) {
      error = caught;
    }

    expect(mapActionError(error).fieldErrors).toEqual({ [field]: expect.stringMatching(/\S/) });
    expect(mapActionError(error).fieldErrors?.[field]).not.toBe("El valor no es válido.");
  });

  it("are not read by the event form (S3): a crafted event save carrying them, even invalid ones, leaves them out", () => {
    const parsed = parseEventFormData(form({ title: "Taller", registrationMode: "open", registrationCapacity: "-4", registrationDeadline: "tomorrow" }));

    expect(parsed.title).toBe("Taller");
    expect(parsed).not.toHaveProperty("registrationMode");
    expect(parsed).not.toHaveProperty("registrationCapacity");
    expect(parsed).not.toHaveProperty("registrationDeadline");
  });
});
