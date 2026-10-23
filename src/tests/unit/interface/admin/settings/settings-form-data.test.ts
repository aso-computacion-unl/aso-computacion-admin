import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

import { parseSiteSettingsFormData } from "@/interface/admin/settings/settings-form-data";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const VALID = { tagline: " Lema ", description: " Descripción ", about: " Acerca " };

describe("parseSiteSettingsFormData", () => {
  it("trims the three texts", () => {
    expect(parseSiteSettingsFormData(form(VALID))).toEqual({ tagline: "Lema", description: "Descripción", about: "Acerca" });
  });

  it("rejects missing required fields and unknown ones", () => {
    expect(() => parseSiteSettingsFormData(form({ tagline: "x" }))).toThrow(ZodError);
    expect(() => parseSiteSettingsFormData(form({ ...VALID, id: "other" }))).toThrow(ZodError);
  });
});
