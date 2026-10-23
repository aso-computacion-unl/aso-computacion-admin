import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

import { parseFaqFormData } from "@/interface/admin/faqs/faq-form-data";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe("parseFaqFormData", () => {
  it("trims the text and reads the publish checkbox", () => {
    expect(parseFaqFormData(form({ question: " ¿Cuesta? ", answer: " No. ", isPublished: "on" }))).toEqual({
      question: "¿Cuesta?",
      answer: "No.",
      isPublished: true,
    });
  });

  it("rejects a missing question and unknown fields", () => {
    expect(() => parseFaqFormData(form({ answer: "No." }))).toThrow(ZodError);
    expect(() => parseFaqFormData(form({ question: "q", answer: "a", sortOrder: "0" }))).toThrow(ZodError);
  });
});
