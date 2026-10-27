import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

import { parseTestimonialFormData } from "@/interface/admin/testimonials/testimonial-form-data";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const VALID = { quote: " Muy útil. ", name: " Ana Pérez ", role: " Egresada " };

describe("parseTestimonialFormData", () => {
  it("trims the text and reads the publish checkbox", () => {
    expect(parseTestimonialFormData(form({ ...VALID, isPublished: "on" }))).toEqual({
      quote: "Muy útil.",
      name: "Ana Pérez",
      role: "Egresada",
      isPublished: true,
    });
  });

  it("passes the image alt through only when the form sends it", () => {
    expect(parseTestimonialFormData(form({ ...VALID, photoAlt: " Charla " })).photoAlt).toBe("Charla");
    expect(parseTestimonialFormData(form(VALID)).photoAlt).toBeUndefined();
  });

  it("rejects missing required fields and unknown ones", () => {
    expect(() => parseTestimonialFormData(form({ quote: "Muy útil." }))).toThrow(ZodError);
    expect(() => parseTestimonialFormData(form({ ...VALID, sortOrder: "0" }))).toThrow(ZodError);
  });
});
