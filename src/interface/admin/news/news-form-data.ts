import { z } from "zod";

import { checkbox, formText, parseStrictForm } from "../form-fields";

// Blank means "derive it / keep the current one": the slug is derived from the
// title on create and the date defaults to today in Ecuador; on update both
// stay as they are.
const optionalText = formText.optional().transform((value) => value || undefined);

// Length rules live in the domain. `coverAlt` is sent only by a form that shows
// the item's current cover; the use case decides what it means.
const newsFormSchema = z.strictObject({
  title: formText,
  slug: optionalText,
  summary: formText,
  // The browser submits line breaks as CRLF; they count as one character in the limit, so store LF.
  body: formText.transform((value) => value.replaceAll("\r\n", "\n")),
  publishedAt: optionalText,
  coverAlt: optionalText,
  isPublished: checkbox,
});

export function parseNewsFormData(formData: FormData) {
  return parseStrictForm(newsFormSchema, formData);
}
