import { z } from "zod";

import { checkbox, formText, parseStrictForm } from "../form-fields";

// Length rules live in the domain. `photoAlt` is sent only by a form that shows
// the member's current photo; the use case decides what it means. S4: the
// schema is strict, so a contact field (phone, email, age, instagram...) in the
// form is an error, never silently ignored or stored.
const boardMemberFormSchema = z.strictObject({
  name: formText,
  role: formText,
  photoAlt: formText.optional(),
  isPublished: checkbox,
});

export function parseBoardMemberFormData(formData: FormData) {
  return parseStrictForm(boardMemberFormSchema, formData);
}
