import { z } from "zod";

import {
  EVENT_DATE_PRECISIONS,
  EVENT_DESCRIPTION_MAX_LENGTH,
  EVENT_SHORT_TEXT_MAX_LENGTH,
  EVENT_TITLE_MAX_LENGTH,
} from "@/domain/event";

import { publicationWindowFields } from "../publication-window-fields";
import { parseRegistrationFormData } from "./registration-form-fields";

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
  // A form post carries line breaks as CRLF; the limit counts a break as one character, so store LF.
  description: z
    .string()
    .trim()
    .transform((value) => value.replaceAll("\r\n", "\n"))
    .pipe(z.string().max(EVENT_DESCRIPTION_MAX_LENGTH, `La descripción admite hasta ${EVENT_DESCRIPTION_MAX_LENGTH} caracteres.`)),
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
  ...publicationWindowFields,
});

/** Keys read only when the form sent them: an absent window end means "leave it as it is", a blank one clears it. */
const OPTIONAL_KEYS = new Set(["publishAt", "unpublishAt"]);

/** The kind a new event is created as: an announcement unless the form sent `eventKind=registration`. */
export const EVENT_KIND_REGISTRATION = "registration";

/** «Evento con inscripción» needs a way to sign up: `none` would make it an announcement. */
const registrationKindSchema = z.object({
  registrationMode: z.enum(["unl", "open"], { error: "Elija una forma de inscripción de la lista." }),
});

/**
 * Reads the create form: the event fields and, only for «Evento con inscripción», its registration settings. An
 * announcement ignores any registration key the post carries. `withRegistration` is the kind the post names, unless the
 * caller fixes it (Inscripciones only creates events with registration).
 */
export function parseCreateEventFormData(formData: FormData, withRegistration = formData.get("eventKind") === EVENT_KIND_REGISTRATION) {
  const event = parseEventFormData(formData);

  if (!withRegistration) {
    return event;
  }

  const settings = parseRegistrationFormData(formData);
  const { registrationMode } = registrationKindSchema.parse({ registrationMode: settings.registrationMode });

  return { ...event, ...settings, registrationMode };
}

/**
 * Reads the event form. Blank optional fields stay as "" and the domain turns them into null. Only the keys of the
 * schema are read: an event save never changes the registration settings.
 */
export function parseEventFormData(formData: FormData) {
  const raw = Object.fromEntries(
    Object.keys(eventFormSchema.shape)
      .filter((key) => !OPTIONAL_KEYS.has(key) || formData.has(key))
      .map((key) => [key, String(formData.get(key) ?? "")]),
  );

  return eventFormSchema.parse(raw);
}
