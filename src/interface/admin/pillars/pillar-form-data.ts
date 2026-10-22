import { z } from "zod";

import { checkbox, formText, parseStrictForm } from "../form-fields";

// Length rules live in the domain. `imageAlt` is sent only by a form that shows
// the pillar's current image; the use case decides what it means.
const pillarFormSchema = z.strictObject({
  word: formText,
  title: formText,
  text: formText,
  imageAlt: formText.optional(),
  isPublished: checkbox,
});

export function parsePillarFormData(formData: FormData) {
  return parseStrictForm(pillarFormSchema, formData);
}
