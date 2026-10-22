"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SwitchField } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/interface/admin/action-result";

import { ActionBar, Field, FormFeedback } from "../../_components/form-parts";
import { useControlledForm } from "../../_components/use-controlled-form";

export interface FaqFormValues {
  question: string;
  answer: string;
  isPublished: boolean;
}

export const EMPTY_FAQ_FORM_VALUES: FaqFormValues = { question: "", answer: "", isPublished: false };

interface FaqFormProps {
  action: (prevState: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  submitLabel: string;
  initialValues?: FaqFormValues;
}

export function FaqForm({ action, submitLabel, initialValues = EMPTY_FAQ_FORM_VALUES }: FaqFormProps) {
  const { bind, toggle, handleSubmit, state, isPending, errors } = useControlledForm(action, initialValues);

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-5">
      <Field label="Pregunta" error={errors.question}>
        {(control) => <Input {...control} {...bind("question")} required maxLength={200} />}
      </Field>
      <Field label="Respuesta" hint="Hasta 1000 caracteres." error={errors.answer}>
        {(control) => <Textarea {...control} {...bind("answer")} rows={6} required maxLength={1000} />}
      </Field>
      <SwitchField
        label="Publicada"
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
