import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

import { parseImpactStatFormData } from "@/interface/admin/impact/impact-stat-form-data";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe("parseImpactStatFormData", () => {
  it("trims the text and reads the publish checkbox", () => {
    expect(parseImpactStatFormData(form({ value: " 120+ ", label: " Estudiantes ", isPublished: "on" }))).toEqual({ value: "120+", label: "Estudiantes", isPublished: true });
    expect(parseImpactStatFormData(form({ value: "15", label: "Talleres" })).isPublished).toBe(false);
  });

  it("rejects missing required fields and unknown ones", () => {
    expect(() => parseImpactStatFormData(form({ value: "120+" }))).toThrow(ZodError);
    expect(() => parseImpactStatFormData(form({ value: "1", label: "x", sortOrder: "0" }))).toThrow(ZodError);
  });
});
