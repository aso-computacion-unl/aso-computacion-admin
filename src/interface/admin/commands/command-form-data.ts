import { z } from "zod";

import { checkbox, formText, parseStrictForm } from "../form-fields";

const commandFormSchema = z.strictObject({
  command: formText,
  description: formText,
  output: formText,
  isPublished: checkbox,
});

export function parseCommandFormData(formData: FormData) {
  return parseStrictForm(commandFormSchema, formData);
}
