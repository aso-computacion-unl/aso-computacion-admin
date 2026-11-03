import { z } from "zod";

import { checkbox, formText, parseStrictForm } from "../form-fields";

// Length and https rules live in the domain; a blank `url` means "no link". `logoAlt` is
// sent only by a form that shows the sponsor's current logo; the use case decides what it means.
const sponsorFormSchema = z.strictObject({
  name: formText,
  url: formText,
  logoAlt: formText.optional(),
  isPublished: checkbox,
});

export function parseSponsorFormData(formData: FormData) {
  return parseStrictForm(sponsorFormSchema, formData);
}
