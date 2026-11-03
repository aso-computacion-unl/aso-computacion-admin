import { z } from "zod";

import { checkbox, formText, multilineText, parseStrictForm } from "../form-fields";

const commandFormSchema = z.strictObject({
  command: formText,
  description: formText,
  output: multilineText,
  isPublished: checkbox,
});

export function parseCommandFormData(formData: FormData) {
  return parseStrictForm(commandFormSchema, formData);
}
