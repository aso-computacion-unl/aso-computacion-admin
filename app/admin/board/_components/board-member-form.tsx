"use client";

import type { ActionResult } from "@/interface/admin/action-result";

import { Field, FormFeedback } from "../../_components/form-parts";
import { useControlledForm } from "../../_components/use-controlled-form";

export interface BoardMemberFormValues {
  name: string;
  role: string;
  /** Alt of the member's current photo; the field shows only when `hasPhoto`, and a blank one is ignored without a photo. */
  photoAlt: string;
  isPublished: boolean;
}

export const EMPTY_BOARD_MEMBER_FORM_VALUES: BoardMemberFormValues = { name: "", role: "", photoAlt: "", isPublished: false };

interface BoardMemberFormProps {
  action: (prevState: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  submitLabel: string;
  initialValues?: BoardMemberFormValues;
  hasPhoto?: boolean;
}

// Only name, role and photo exist for a member: no contact data is collected (S4).
export function BoardMemberForm({ action, submitLabel, initialValues = EMPTY_BOARD_MEMBER_FORM_VALUES, hasPhoto = false }: BoardMemberFormProps) {
  const { bind, toggle, handleSubmit, state, isPending, errors } = useControlledForm(action, initialValues);

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Field label="Nombre" hint="El nombre que se muestra en el sitio público. Hasta 60 caracteres." error={errors.name}>
        {(control) => <input {...control} {...bind("name")} required maxLength={60} />}
      </Field>
      <Field label="Cargo" hint="Por ejemplo «Presidente». Hasta 60 caracteres." error={errors.role}>
        {(control) => <input {...control} {...bind("role")} required maxLength={60} />}
      </Field>
      {hasPhoto ? (
        <Field label="Descripción de la foto" hint="Obligatoria, para accesibilidad. Hasta 200 caracteres." error={errors.photoAlt}>
          {(control) => <input {...control} {...bind("photoAlt")} required maxLength={200} />}
        </Field>
      ) : null}
      <p className="field">
        <label>
          <input type="checkbox" {...toggle("isPublished")} /> Publicado
        </label>
        <small className="field-hint">
          {hasPhoto
            ? "Los borradores no salen en el sitio. Los cambios llegan al sitio público en su próxima actualización."
            : "Sin foto no se puede publicar: suba la foto primero."}
        </small>
        {errors.photo ? (
          <small role="alert" className="field-error">
            {errors.photo}
          </small>
        ) : null}
      </p>
      <FormFeedback state={state} />
      <button type="submit" aria-disabled={isPending || undefined}>
        {isPending ? "Guardando..." : submitLabel}
      </button>
    </form>
  );
}
