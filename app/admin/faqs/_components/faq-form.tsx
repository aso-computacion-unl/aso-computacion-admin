"use client";

import type { ActionResult } from "@/interface/admin/action-result";

import { Field, FormFeedback } from "../../_components/form-parts";
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
    <form onSubmit={handleSubmit} noValidate>
      <Field label="Pregunta" error={errors.question}>
        {(control) => <input {...control} {...bind("question")} required maxLength={200} />}
      </Field>
      <Field label="Respuesta" hint="Hasta 1000 caracteres." error={errors.answer}>
        {(control) => <textarea {...control} {...bind("answer")} rows={6} required maxLength={1000} />}
      </Field>
      <p className="field">
        <label>
          <input type="checkbox" {...toggle("isPublished")} /> Publicada
        </label>
        <small className="field-hint">
          Los borradores no salen en el sitio. Los cambios llegan al sitio público en su próxima actualización.
        </small>
      </p>
      <FormFeedback state={state} />
      <button type="submit" aria-disabled={isPending || undefined}>
        {isPending ? "Guardando..." : submitLabel}
      </button>
    </form>
  );
}
