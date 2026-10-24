import { z } from "zod";

import { checkbox, formText, parseStrictForm } from "../form-fields";

const faqFormSchema = z.strictObject({
  question: formText,
  answer: formText,
  /** Optional: blank clears it; the format and uniqueness rules live in the domain and use cases. */
  command: z.string().trim().optional(),
  isPublished: checkbox,
});

export function parseFaqFormData(formData: FormData) {
  return parseStrictForm(faqFormSchema, formData);
}
