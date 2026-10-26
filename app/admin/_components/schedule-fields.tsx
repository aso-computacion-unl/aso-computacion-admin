import { Input } from "@/components/ui/input";

import { Field } from "./form-parts";

interface ScheduleFieldsProps {
  /** `bind("publishAt")` and `bind("unpublishAt")` of the form that owns the values. */
  publishAt: { name: string; value: string; onChange: (event: { target: { value: string } }) => void };
  unpublishAt: { name: string; value: string; onChange: (event: { target: { value: string } }) => void };
  errors: Record<string, string | undefined>;
  /** What is scheduled, for the hints: "el evento" or "la noticia". */
  subject: string;
}

/** The two optional ends of a publish window. Times are Ecuador time (America/Guayaquil, UTC-5), the same for every editor. */
export function ScheduleFields({ publishAt, unpublishAt, errors, subject }: ScheduleFieldsProps) {
  return (
    <>
      <Field
        label="Publicar el"
        hint={`Hora de Ecuador. Con ${subject} publicado, sale en el sitio desde este momento. Vacío: sale de inmediato.`}
        error={errors.publishAt}
      >
        {(control) => <Input {...control} {...publishAt} type="datetime-local" />}
      </Field>
      <Field
        label="Retirar el"
        hint={`Hora de Ecuador. A partir de este momento ${subject} deja de salir en el sitio. Vacío: no se retira.`}
        error={errors.unpublishAt}
      >
        {(control) => <Input {...control} {...unpublishAt} type="datetime-local" />}
      </Field>
    </>
  );
}
