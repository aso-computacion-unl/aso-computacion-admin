import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

import { parseSponsorFormData } from "@/interface/admin/sponsors/sponsor-form-data";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const VALID = { name: " Acme ", url: " https://acme.test " };

describe("parseSponsorFormData", () => {
  it("trims the text and reads the publish checkbox", () => {
    expect(parseSponsorFormData(form({ ...VALID, isPublished: "on" }))).toEqual({
      name: "Acme",
      url: "https://acme.test",
      isPublished: true,
    });
  });

  it("passes the image alt through only when the form sends it", () => {
    expect(parseSponsorFormData(form({ ...VALID, logoAlt: " Charla " })).logoAlt).toBe("Charla");
    expect(parseSponsorFormData(form(VALID)).logoAlt).toBeUndefined();
  });

  it("rejects missing required fields and unknown ones", () => {
    expect(() => parseSponsorFormData(form({ name: "Acme" }))).toThrow(ZodError);
    expect(() => parseSponsorFormData(form({ ...VALID, sortOrder: "0" }))).toThrow(ZodError);
  });
});
