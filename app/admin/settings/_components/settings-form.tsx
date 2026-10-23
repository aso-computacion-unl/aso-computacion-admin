"use client";

import type { ActionResult } from "@/interface/admin/action-result";

import { Field, FormFeedback } from "../../_components/form-parts";
import { useControlledForm } from "../../_components/use-controlled-form";

export interface SettingsFormValues {
  tagline: string;
  description: string;
  about: string;
}

export const EMPTY_SETTINGS_FORM_VALUES: SettingsFormValues = { tagline: "", description: "", about: "" };

interface SettingsFormProps {
  action: (prevState: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  initialValues?: SettingsFormValues;
}

export function SettingsForm({ action, initialValues = EMPTY_SETTINGS_FORM_VALUES }: SettingsFormProps) {
  const { bind, handleSubmit, state, isPending, errors } = useControlledForm(action, initialValues);

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Field label="Lema" hint="Hasta 120 caracteres." error={errors.tagline}>
        {(control) => <input {...control} {...bind("tagline")} required maxLength={120} />}
      </Field>
      <Field label="Descripción" hint="Resumen corto del sitio. Hasta 300 caracteres." error={errors.description}>
        {(control) => <textarea {...control} {...bind("description")} rows={3} required maxLength={300} />}
      </Field>
      <Field label="Acerca de" hint="Hasta 600 caracteres." error={errors.about}>
        {(control) => <textarea {...control} {...bind("about")} rows={8} required maxLength={600} />}
      </Field>
      <small className="field-hint">Los cambios llegan al sitio público en su próxima actualización.</small>
      <FormFeedback state={state} />
      <button type="submit" aria-disabled={isPending || undefined}>
        {isPending ? "Guardando..." : "Guardar cambios"}
      </button>
    </form>
  );
}
