import { z } from "zod";

import { checkbox, formText, parseStrictForm } from "../form-fields";

// Length and platform rules live in the domain; blank chips are cleared there.
const socialLinkFormSchema = z.strictObject({
  platform: formText,
  label: formText,
  handle: formText,
  url: formText,
  note: formText.default(""),
  blurb: formText.default(""),
  isPublished: checkbox,
});

export function parseSocialLinkFormData(formData: FormData) {
  return parseStrictForm(socialLinkFormSchema, formData);
}
