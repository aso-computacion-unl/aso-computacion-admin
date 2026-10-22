import { z } from "zod";

import { checkbox, formText, parseStrictForm } from "../form-fields";

const faqFormSchema = z.strictObject({
  question: formText,
  answer: formText,
  isPublished: checkbox,
});

export function parseFaqFormData(formData: FormData) {
  return parseStrictForm(faqFormSchema, formData);
}
