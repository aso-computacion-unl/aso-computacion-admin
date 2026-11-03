import { z } from "zod";

import { formText, parseStrictForm } from "../form-fields";

// Blank means "derive it / keep it": the slug comes from the name on create and stays on update. Length
// rules live in the domain.
const optionalText = formText.optional().transform((value) => value || undefined);

const categoryFormSchema = z.strictObject({
  name: formText,
  description: optionalText,
  slug: optionalText,
});

export function parseCategoryFormData(formData: FormData) {
  return parseStrictForm(categoryFormSchema, formData);
}
