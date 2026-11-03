import { z } from "zod";

import { formText, multilineText, parseStrictForm } from "../form-fields";

// Length rules live in the domain.
const siteSettingsFormSchema = z.strictObject({
  tagline: formText,
  description: multilineText,
  about: multilineText,
});

export function parseSiteSettingsFormData(formData: FormData) {
  return parseStrictForm(siteSettingsFormSchema, formData);
}
