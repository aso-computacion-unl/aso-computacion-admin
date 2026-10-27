import { z } from "zod";

import { checkbox, formText, parseStrictForm } from "../form-fields";

// Length rules live in the domain.
const impactStatFormSchema = z.strictObject({
  value: formText,
  label: formText,
  isPublished: checkbox,
});

export function parseImpactStatFormData(formData: FormData) {
  return parseStrictForm(impactStatFormSchema, formData);
}
