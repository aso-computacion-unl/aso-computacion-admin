import { z } from "zod";

import { formText, parseStrictForm } from "../form-fields";

// Length rules live in the domain.
const siteSettingsFormSchema = z.strictObject({
  tagline: formText,
  description: formText,
  about: formText,
});

export function parseSiteSettingsFormData(formData: FormData) {
  return parseStrictForm(siteSettingsFormSchema, formData);
}
