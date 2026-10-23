"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/interface/admin/action-result";

import { ActionBar, Field, FormFeedback } from "../../_components/form-parts";
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
    <form onSubmit={handleSubmit} noValidate className="grid gap-5">
      <Field label="Lema" hint="Hasta 120 caracteres." error={errors.tagline}>
        {(control) => <Input {...control} {...bind("tagline")} required maxLength={120} />}
      </Field>
      <Field label="Descripción" hint="Resumen corto del sitio. Hasta 300 caracteres." error={errors.description}>
        {(control) => <Textarea {...control} {...bind("description")} rows={3} required maxLength={300} />}
      </Field>
      <Field label="Acerca de" hint="Hasta 600 caracteres." error={errors.about}>
        {(control) => <Textarea {...control} {...bind("about")} rows={8} required maxLength={600} />}
      </Field>
      <p className="text-[0.8125rem] text-mist">Los cambios llegan al sitio público en su próxima actualización.</p>
      <ActionBar status={<FormFeedback state={state} />}>
        <Button type="submit" busy={isPending} aria-disabled={isPending || undefined} className="min-h-12">
          {isPending ? "Guardando…" : "Guardar cambios"}
        </Button>
      </ActionBar>
    </form>
  );
}
