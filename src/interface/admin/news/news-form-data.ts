import { z } from "zod";

import { checkbox, formText, multilineText, parseStrictForm } from "../form-fields";
import { publicationWindowFields } from "../publication-window-fields";

// Blank means "derive it / keep the current one": the slug is derived from the
// title on create and the date defaults to today in Ecuador; on update both
// stay as they are.
const optionalText = formText.optional().transform((value) => value || undefined);

// Length rules live in the domain. `coverAlt` is sent only by a form that shows
// the item's current cover; the use case decides what it means.
const newsFormSchema = z.strictObject({
  title: formText,
  slug: optionalText,
  summary: multilineText,
  body: multilineText,
  publishedAt: optionalText,
  coverAlt: optionalText,
  isPublished: checkbox,
  ...publicationWindowFields,
});

export function parseNewsFormData(formData: FormData) {
  return parseStrictForm(newsFormSchema, formData);
}
