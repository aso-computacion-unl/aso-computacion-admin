"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SwitchField } from "@/components/ui/switch";
import type { ActionResult } from "@/interface/admin/action-result";

import { ActionBar, Field, FormFeedback } from "../../_components/form-parts";
import { useControlledForm } from "../../_components/use-controlled-form";

export interface ImpactStatFormValues {
  value: string;
  label: string;
  isPublished: boolean;
}

export const EMPTY_IMPACT_STAT_FORM_VALUES: ImpactStatFormValues = { value: "", label: "", isPublished: false };

interface ImpactStatFormProps {
  action: (prevState: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  submitLabel: string;
  initialValues?: ImpactStatFormValues;
}

export function ImpactStatForm({ action, submitLabel, initialValues = EMPTY_IMPACT_STAT_FORM_VALUES }: ImpactStatFormProps) {
  const { bind, toggle, handleSubmit, state, isPending, errors } = useControlledForm(action, initialValues);

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-5">
      <div className="grid gap-x-4 gap-y-5 @xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Field label="Cifra" hint="Lo que se ve en grande, por ejemplo «120+». Hasta 20 caracteres." error={errors.value}>
          {(control) => <Input {...control} {...bind("value")} required maxLength={20} />}
        </Field>
        <Field label="Qué cuenta" hint="Por ejemplo «Estudiantes en la comunidad». Hasta 60 caracteres." error={errors.label}>
          {(control) => <Input {...control} {...bind("label")} required maxLength={60} />}
        </Field>
      </div>
      <SwitchField
        label="Publicado"
        description="Los borradores no salen en el sitio. Los cambios llegan al sitio público en su próxima actualización."
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
