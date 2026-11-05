import { MAX_ACTIVE_EVENT_PHOTOS } from "@/domain/event-photo";

/*
 * The Spanish text of every field a form can get wrong. Pure data with no server imports: the server
 * actions answer with these texts and the forms show the same ones when the browser's own constraints
 * (`required`, `type="url"`) fail first, so a field reads the same whichever side caught it.
 */

export const IMAGE_FORMAT_MESSAGE = "Elija una imagen JPEG, PNG o WebP de hasta 5 MB.";

export const FIELD_MESSAGES: Record<string, string> = {
  title: "El título es obligatorio y admite hasta 120 caracteres.",
  slug: "El identificador solo admite minúsculas, números y guiones, y no puede repetirse.",
  description: "La descripción admite hasta 600 caracteres.",
  date: "Indique una fecha válida.",
  datePrecision: "Elija fecha exacta o solo mes.",
  type: "Elija un tipo de la lista.",
  commitMessage: "El mensaje admite hasta 80 caracteres.",
  hora: "Admite hasta 80 caracteres.",
  lugar: "Admite hasta 80 caracteres.",
  para: "Admite hasta 80 caracteres.",
  linkUrl: "Use un enlace que empiece con https://.",
  linkLabel: "El texto del enlace admite hasta 80 caracteres y requiere un enlace.",
  highlights: "Hasta 8 líneas de 80 caracteres como máximo.",
  command: "Use de 2 a 28 caracteres: minúsculas, números y guiones simples, empezando con una letra.",
  question: "La pregunta es obligatoria y admite hasta 200 caracteres.",
  answer: "La respuesta es obligatoria y admite hasta 1000 caracteres.",
  platform: "Elija una red de la lista.",
  label: "El nombre es obligatorio y admite hasta 40 caracteres.",
  handle: "El usuario es obligatorio y admite hasta 60 caracteres.",
  url: "Use un enlace que empiece con https://.",
  note: "La nota admite hasta 40 caracteres.",
  blurb: "La descripción corta admite hasta 80 caracteres.",
  word: "La palabra es obligatoria y admite hasta 20 caracteres.",
  text: "El texto es obligatorio y admite hasta 300 caracteres.",
  imageAlt: "Describa la imagen en 1 a 200 caracteres.",
  name: "El nombre es obligatorio y admite hasta 60 caracteres.",
  role: "El cargo es obligatorio y admite hasta 60 caracteres.",
  photo: "Suba una foto antes de publicar al integrante.",
  photoAlt: "Describa la foto en 1 a 200 caracteres.",
  alt: "Describa la foto en 1 a 200 caracteres.",
  file: IMAGE_FORMAT_MESSAGE,
  value: "El valor es obligatorio y admite hasta 20 caracteres.",
  quote: "La cita es obligatoria y admite hasta 300 caracteres.",
  logo: "Suba un logo antes de publicar al aliado.",
  logoAlt: "Describa el logo en 1 a 200 caracteres.",
  email: "Escriba un correo válido.",
  publishAt: "Indique una fecha y hora válidas.",
  unpublishAt: "La fecha de retiro debe ser posterior a la de publicación.",
  registrationMode: "Elija una forma de inscripción de la lista.",
  registrationCapacity: "Indique un número entero de 1 a 5000.",
  registrationDeadline: "Indique una fecha y hora válidas.",
  photos: `El evento ya tiene ${MAX_ACTIVE_EVENT_PHOTOS} fotos activas. Quite una para subir otra.`,
};

const FALLBACK_FIELD_MESSAGE = "El valor no es válido.";

/** The text of a field: the entity's own wording when its limits differ, else the shared one. */
export function fieldMessage(field: string, overrides?: Record<string, string>): string {
  return overrides?.[field] ?? FIELD_MESSAGES[field] ?? FALLBACK_FIELD_MESSAGE;
}

// Entities whose limits differ from the shared wording. Each action file maps its errors with these and
// its form hands the same object to `useControlledForm`.
export const NEWS_FIELD_MESSAGES = {
  summary: "El resumen es obligatorio y admite hasta 280 caracteres.",
  body: "El texto es obligatorio y admite hasta 10000 caracteres.",
  publishedAt: "Indique una fecha de publicación válida.",
  coverAlt: "Describa la portada en 1 a 200 caracteres.",
};

export const PILLAR_FIELD_MESSAGES = { title: "El título es obligatorio y admite hasta 60 caracteres." };

export const SPONSOR_FIELD_MESSAGES = { url: "Use un enlace que empiece con https:// y tenga hasta 300 caracteres." };

export const FORUM_CATEGORY_FIELD_MESSAGES = {
  name: "El nombre es obligatorio y admite hasta 60 caracteres.",
  description: "La descripción admite hasta 200 caracteres.",
};

export const USER_FIELD_MESSAGES = {
  role: "Elija un rol de la lista.",
  name: "El nombre admite hasta 120 caracteres.",
};

// A free command's description and output have their own limits, unlike the shared wording.
export const COMMAND_FIELD_MESSAGES = {
  description: "La descripción es obligatoria y admite hasta 80 caracteres.",
  output: "La respuesta es obligatoria y admite hasta 600 caracteres.",
};

export const SETTINGS_FIELD_MESSAGES = {
  tagline: "El lema es obligatorio y admite hasta 120 caracteres.",
  description: "La descripción es obligatoria y admite hasta 300 caracteres.",
  about: "El texto «Acerca de» es obligatorio y admite hasta 600 caracteres.",
};
