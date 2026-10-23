"use client";

import type { ActionResult } from "@/interface/admin/action-result";
import { SOCIAL_PLATFORMS } from "@/domain/social-link";

import { Field, FormFeedback } from "../../_components/form-parts";
import { useControlledForm } from "../../_components/use-controlled-form";

export interface SocialFormValues {
  platform: string;
  label: string;
  handle: string;
  url: string;
  note: string;
  blurb: string;
  isPublished: boolean;
}

export const EMPTY_SOCIAL_FORM_VALUES: SocialFormValues = {
  platform: SOCIAL_PLATFORMS[0],
  label: "",
  handle: "",
  url: "",
  note: "",
  blurb: "",
  isPublished: false,
};

interface SocialFormProps {
  action: (prevState: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  submitLabel: string;
  initialValues?: SocialFormValues;
}

export function SocialForm({ action, submitLabel, initialValues = EMPTY_SOCIAL_FORM_VALUES }: SocialFormProps) {
  const { bind, toggle, handleSubmit, state, isPending, errors } = useControlledForm(action, initialValues);

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Field label="Red" error={errors.platform}>
        {(control) => (
          <select {...control} {...bind("platform")} required>
            {SOCIAL_PLATFORMS.map((platform) => (
              <option key={platform} value={platform}>
                {platform}
              </option>
            ))}
          </select>
        )}
      </Field>
      <Field label="Nombre" hint="Como se muestra en el sitio, por ejemplo «Instagram». Hasta 40 caracteres." error={errors.label}>
        {(control) => <input {...control} {...bind("label")} required maxLength={40} />}
      </Field>
      <Field label="Usuario" hint="Por ejemplo «@aso_computacion». Hasta 60 caracteres." error={errors.handle}>
        {(control) => <input {...control} {...bind("handle")} required maxLength={60} />}
      </Field>
      <Field label="Enlace" hint="Debe empezar con https://." error={errors.url}>
        {(control) => <input type="url" {...control} {...bind("url")} required />}
      </Field>
      <Field label="Nota (opcional)" hint="Etiqueta corta junto a la red. Hasta 40 caracteres." error={errors.note}>
        {(control) => <input {...control} {...bind("note")} maxLength={40} />}
      </Field>
      <Field label="Descripción corta (opcional)" hint="Hasta 80 caracteres." error={errors.blurb}>
        {(control) => <input {...control} {...bind("blurb")} maxLength={80} />}
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
