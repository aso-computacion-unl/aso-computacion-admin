import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

import { parseCommandFormData } from "@/interface/admin/commands/command-form-data";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe("parseCommandFormData", () => {
  it("trims the text, keeps the line breaks of the output and reads the publish checkbox", () => {
    expect(
      parseCommandFormData(form({ command: " horario ", description: " Cuándo ", output: " Martes.\nJueves. ", isPublished: "on" })),
    ).toEqual({ command: "horario", description: "Cuándo", output: "Martes.\nJueves.", isPublished: true });
  });

  it("rejects a missing field and unknown fields", () => {
    expect(() => parseCommandFormData(form({ description: "d", output: "o" }))).toThrow(ZodError);
    expect(() => parseCommandFormData(form({ command: "horario", description: "d" }))).toThrow(ZodError);
    expect(() => parseCommandFormData(form({ command: "horario", description: "d", output: "o", sortOrder: "0" }))).toThrow(ZodError);
  });
});
