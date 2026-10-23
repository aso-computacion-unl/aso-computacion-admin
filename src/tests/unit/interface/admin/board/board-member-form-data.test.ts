import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

import { parseBoardMemberFormData } from "@/interface/admin/board/board-member-form-data";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const VALID = { name: " Ana Pérez ", role: " Presidenta " };

describe("parseBoardMemberFormData", () => {
  it("trims the text and reads the publish checkbox", () => {
    expect(parseBoardMemberFormData(form({ ...VALID, isPublished: "on" }))).toEqual({
      name: "Ana Pérez",
      role: "Presidenta",
      isPublished: true,
    });
  });

  it("passes the photo alt through only when the form sends it", () => {
    expect(parseBoardMemberFormData(form({ ...VALID, photoAlt: " Ana " })).photoAlt).toBe("Ana");
    expect(parseBoardMemberFormData(form(VALID)).photoAlt).toBeUndefined();
  });

  it("rejects missing required fields and sortOrder", () => {
    expect(() => parseBoardMemberFormData(form({ name: "Ana" }))).toThrow(ZodError);
    expect(() => parseBoardMemberFormData(form({ ...VALID, sortOrder: "0" }))).toThrow(ZodError);
  });

  // S4: the strict schema is the last line of defence against a contact field riding along.
  it.each(["phone", "email", "age", "instagram", "ciclo", "telefono", "edad", "whatsapp"])("rejects a %s field (S4)", (field) => {
    const parse = () => parseBoardMemberFormData(form({ ...VALID, [field]: "x" }));

    expect(parse).toThrow(ZodError);
    expect(parse).toThrow(/unrecognized/i);
  });
});
