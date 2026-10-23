"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SwitchField } from "@/components/ui/switch";
import { SOCIAL_PLATFORMS } from "@/domain/social-link";
import type { ActionResult } from "@/interface/admin/action-result";
import { socialPlatformLabel } from "@/interface/admin/socials/platform-labels";

import { ActionBar, Field, FormFeedback } from "../../_components/form-parts";
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
  // The name starts as the platform's own spelling: most links keep it.
  label: socialPlatformLabel(SOCIAL_PLATFORMS[0]),
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
  const platform = bind("platform");
  const label = bind("label");

  /** Changing the platform renames the link only while its name is still the previous platform's own (or blank). */
  function choosePlatform(event: { target: { value: string } }) {
    const untouched = label.value.trim() === "" || label.value === socialPlatformLabel(platform.value);

    if (untouched) label.onChange({ target: { value: socialPlatformLabel(event.target.value) } });
    platform.onChange(event);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-5">
      <div className="grid gap-x-4 gap-y-5 md:grid-cols-2">
        <Field label="Red" error={errors.platform}>
          {(control) => (
            <Select {...control} {...platform} onChange={choosePlatform} required>
              {SOCIAL_PLATFORMS.map((id) => (
                <option key={id} value={id}>
                  {socialPlatformLabel(id)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Nombre" hint="Como se muestra en el sitio. Hasta 40 caracteres." error={errors.label}>
          {(control) => <Input {...control} {...label} required maxLength={40} />}
        </Field>
        <Field label="Usuario" hint="Por ejemplo «@aso_computacion». Hasta 60 caracteres." error={errors.handle}>
          {(control) => <Input {...control} {...bind("handle")} required maxLength={60} />}
        </Field>
        <Field label="Enlace" hint="Debe empezar con https://." error={errors.url}>
          {(control) => <Input type="url" inputMode="url" {...control} {...bind("url")} required />}
        </Field>
        <Field label="Nota (opcional)" hint="Etiqueta corta junto a la red. Hasta 40 caracteres." error={errors.note}>
          {(control) => <Input {...control} {...bind("note")} maxLength={40} />}
        </Field>
        <Field label="Descripción corta (opcional)" hint="Hasta 80 caracteres." error={errors.blurb}>
          {(control) => <Input {...control} {...bind("blurb")} maxLength={80} />}
        </Field>
      </div>
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
