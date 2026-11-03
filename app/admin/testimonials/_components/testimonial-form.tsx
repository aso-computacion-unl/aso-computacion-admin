"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SwitchField } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/interface/admin/action-result";

import { ActionBar, Field, FormFeedback } from "../../_components/form-parts";
import { useControlledForm } from "../../_components/use-controlled-form";

export interface TestimonialFormValues {
  quote: string;
  name: string;
  role: string;
  /** Alt of the testimonial's current photo; the field shows only when `hasPhoto`, and a blank one is ignored without a photo. */
  photoAlt: string;
  isPublished: boolean;
}

export const EMPTY_TESTIMONIAL_FORM_VALUES: TestimonialFormValues = { quote: "", name: "", role: "", photoAlt: "", isPublished: false };

interface TestimonialFormProps {
  action: (prevState: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  submitLabel: string;
  initialValues?: TestimonialFormValues;
  hasPhoto?: boolean;
}

// A testimonial is public: only the quote, who said it and an optional photo exist. No contact data is collected.
export function TestimonialForm({ action, submitLabel, initialValues = EMPTY_TESTIMONIAL_FORM_VALUES, hasPhoto = false }: TestimonialFormProps) {
  const { bind, toggle, handleSubmit, state, isPending, errors } = useControlledForm(action, initialValues);

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-5">
      <Field label="Cita" hint="Lo que dijo la persona, tal como lo autorizó. Hasta 300 caracteres." error={errors.quote}>
        {(control) => <Textarea {...control} {...bind("quote")} rows={4} required maxLength={300} />}
      </Field>
      <div className="grid gap-x-4 gap-y-5 @xl:grid-cols-2">
        <Field label="Nombre" hint="Cómo se muestra en el sitio público. Hasta 60 caracteres." error={errors.name}>
          {(control) => <Input {...control} {...bind("name")} required maxLength={60} />}
        </Field>
        <Field label="Cargo o afiliación" hint="Por ejemplo «Egresada de Computación». Hasta 80 caracteres." error={errors.role}>
          {(control) => <Input {...control} {...bind("role")} required maxLength={80} />}
        </Field>
      </div>
      {hasPhoto ? (
        <Field label="Descripción de la foto" hint="Obligatoria, para accesibilidad. Hasta 200 caracteres." error={errors.photoAlt}>
          {(control) => <Input {...control} {...bind("photoAlt")} required maxLength={200} />}
        </Field>
      ) : null}
      <SwitchField
        label="Publicado"
        description="Los borradores no salen en el sitio. La foto es opcional. Los cambios llegan al sitio público en su próxima actualización."
        {...toggle("isPublished")}
      />
      <ActionBar status={<FormFeedback state={state} />}>
        <Button type="submit" busy={isPending} aria-disabled={isPending || undefined} className="min-h-12">
          {isPending ? "Guardando…" : submitLabel}
        </Button>
      </ActionBar>
    </form>
  );
}
