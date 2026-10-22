import { z } from "zod";

/** A checked box arrives as `on`; an unchecked one is absent from the form. */
export const checkbox = z
  .string()
  .optional()
  .transform((value) => value === "on" || value === "true");

/** Required text field: trimmed here, length rules live in the domain. */
export const formText = z.string({ error: "Complete este campo." }).trim();

/**
 * Reads a whole form through a strict schema: a field the schema does not
 * declare is an error, never silently ignored, so nothing extra can ride along
 * into a use case.
 */
export function parseStrictForm<S extends z.ZodObject>(schema: S, formData: FormData): z.output<S> {
  return schema.parse(Object.fromEntries(formData.entries()));
}

/** Controlled form values to FormData: text as is, only checked boxes as `on`. */
export function toFormData(values: Record<string, string | boolean>): FormData {
  const formData = new FormData();

  for (const [key, value] of Object.entries(values)) {
    if (typeof value === "boolean") {
      if (value) formData.set(key, "on");
    } else {
      formData.set(key, value);
    }
  }

  return formData;
}
