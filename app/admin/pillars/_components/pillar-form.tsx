"use client";

import type { ActionResult } from "@/interface/admin/action-result";

import { Field, FormFeedback } from "../../_components/form-parts";
import { useControlledForm } from "../../_components/use-controlled-form";

export interface PillarFormValues {
  word: string;
  title: string;
  text: string;
  /** Alt of the pillar's current image; the field shows only when `hasImage`, and a blank one is ignored without an image. */
  imageAlt: string;
  isPublished: boolean;
}

export const EMPTY_PILLAR_FORM_VALUES: PillarFormValues = { word: "", title: "", text: "", imageAlt: "", isPublished: false };

interface PillarFormProps {
  action: (prevState: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  submitLabel: string;
  initialValues?: PillarFormValues;
  hasImage?: boolean;
}

export function PillarForm({ action, submitLabel, initialValues = EMPTY_PILLAR_FORM_VALUES, hasImage = false }: PillarFormProps) {
  const { bind, toggle, handleSubmit, state, isPending, errors } = useControlledForm(action, initialValues);

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Field label="Palabra" hint="La palabra grande de la tarjeta, por ejemplo «VOZ». Hasta 20 caracteres." error={errors.word}>
        {(control) => <input {...control} {...bind("word")} required maxLength={20} />}
      </Field>
      <Field label="Título" hint="Hasta 60 caracteres." error={errors.title}>
        {(control) => <input {...control} {...bind("title")} required maxLength={60} />}
      </Field>
      <Field label="Texto" hint="Hasta 300 caracteres." error={errors.text}>
        {(control) => <textarea {...control} {...bind("text")} rows={4} required maxLength={300} />}
      </Field>
      {hasImage ? (
        <Field label="Descripción de la imagen" hint="Obligatoria, para accesibilidad. Hasta 200 caracteres." error={errors.imageAlt}>
          {(control) => <input {...control} {...bind("imageAlt")} required maxLength={200} />}
        </Field>
      ) : null}
      <p className="field">
        <label>
          <input type="checkbox" {...toggle("isPublished")} /> Publicado
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
