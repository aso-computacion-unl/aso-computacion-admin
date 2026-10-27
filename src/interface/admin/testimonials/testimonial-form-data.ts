import { z } from "zod";

import { checkbox, formText, parseStrictForm } from "../form-fields";

// Length rules live in the domain. `photoAlt` is sent only by a form that shows the
// testimonial's current photo; the use case decides what it means. The schema is
// strict, so a contact field (email, phone...) in the form is an error, never
// silently ignored or stored.
const testimonialFormSchema = z.strictObject({
  quote: formText,
  name: formText,
  role: formText,
  photoAlt: formText.optional(),
  isPublished: checkbox,
});

export function parseTestimonialFormData(formData: FormData) {
  return parseStrictForm(testimonialFormSchema, formData);
}
