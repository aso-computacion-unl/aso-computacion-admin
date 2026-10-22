import { z } from "zod";

import {
  EVENT_DATE_PRECISIONS,
  EVENT_DESCRIPTION_MAX_LENGTH,
  EVENT_SHORT_TEXT_MAX_LENGTH,
  EVENT_TITLE_MAX_LENGTH,
} from "@/domain/event";

const shortText = (message: string) => z.string().trim().max(EVENT_SHORT_TEXT_MAX_LENGTH, message);
const checkbox = z.string().transform((value) => value === "on" || value === "true");
const HINT_80 = "Admite hasta 80 caracteres.";

const eventFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "El título es obligatorio.")
    .max(EVENT_TITLE_MAX_LENGTH, `El título admite hasta ${EVENT_TITLE_MAX_LENGTH} caracteres.`),
  // Blank means "derive it from the title" on create and "keep the current one" on update.
  slug: z
    .string()
    .trim()
    .transform((value) => value || undefined),
  description: z
    .string()
    .trim()
    .max(EVENT_DESCRIPTION_MAX_LENGTH, `La descripción admite hasta ${EVENT_DESCRIPTION_MAX_LENGTH} caracteres.`),
  date: z.string().trim(),
  // An absent field means an exact date; anything but the two known values is rejected.
  datePrecision: z
    .string()
    .trim()
    .transform((value) => value || "day")
    .pipe(z.enum(EVENT_DATE_PRECISIONS)),
  type: z.string().trim(),
  commitMessage: shortText(HINT_80),
  hora: shortText(HINT_80),
  lugar: shortText(HINT_80),
  para: shortText(HINT_80),
  featured: checkbox,
  linkUrl: z.string().trim(),
  linkLabel: shortText(HINT_80),
  // One highlight per line; blank lines are dropped.
  highlights: z.string().transform((value) =>
    value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean),
  ),
  isPublished: checkbox,
});

/** Reads the event form. Blank optional fields stay as "" and the domain turns them into null. */
export function parseEventFormData(formData: FormData) {
  const raw = Object.fromEntries(
    Object.keys(eventFormSchema.shape).map((key) => [key, String(formData.get(key) ?? "")]),
  );

  return eventFormSchema.parse(raw);
}
