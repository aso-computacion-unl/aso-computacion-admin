"use client";

import { useId } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SwitchField } from "@/components/ui/switch";
import type { ActionResult } from "@/interface/admin/action-result";
import { SPONSOR_FIELD_MESSAGES } from "@/interface/admin/field-messages";

import { ActionBar, Field, FieldError, FormFeedback } from "../../_components/form-parts";
import { useControlledForm } from "../../_components/use-controlled-form";

export interface SponsorFormValues {
  name: string;
  /** Empty means the logo is shown without a link. */
  url: string;
  /** Alt of the sponsor's current logo; the field shows only when `hasLogo`, and a blank one is ignored without a logo. */
  logoAlt: string;
  isPublished: boolean;
}

export const EMPTY_SPONSOR_FORM_VALUES: SponsorFormValues = { name: "", url: "", logoAlt: "", isPublished: false };

interface SponsorFormProps {
  action: (prevState: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  submitLabel: string;
  initialValues?: SponsorFormValues;
  hasLogo?: boolean;
}

export function SponsorForm({ action, submitLabel, initialValues = EMPTY_SPONSOR_FORM_VALUES, hasLogo = false }: SponsorFormProps) {
  const { bind, toggle, handleSubmit, state, isPending, errors } = useControlledForm(action, initialValues, { fieldMessages: SPONSOR_FIELD_MESSAGES });
  const logoErrorId = `${useId()}-logo-error`;

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-5">
      <div className="grid gap-x-4 gap-y-5 @xl:grid-cols-2">
        <Field label="Nombre" hint="El de la empresa o aliado. Hasta 60 caracteres." error={errors.name}>
          {(control) => <Input {...control} {...bind("name")} required maxLength={60} />}
        </Field>
        <Field label="Enlace (opcional)" hint="Debe empezar con https://. Si lo deja vacío, el logo no lleva enlace." error={errors.url}>
          {(control) => <Input {...control} {...bind("url")} type="url" inputMode="url" maxLength={300} />}
        </Field>
      </div>
      {hasLogo ? (
        <Field label="Descripción del logo" hint="Obligatoria, para accesibilidad. Hasta 200 caracteres." error={errors.logoAlt}>
          {(control) => <Input {...control} {...bind("logoAlt")} required maxLength={200} />}
        </Field>
      ) : null}
      <div className="grid gap-1">
        <SwitchField
          label="Publicado"
          description={
            hasLogo
              ? "Los borradores no salen en el sitio. Los cambios llegan al sitio público en su próxima actualización."
              : "Sin logo no se puede publicar: suba el logo primero."
          }
          {...toggle("isPublished")}
          aria-describedby={errors.logo ? logoErrorId : undefined}
          aria-invalid={errors.logo ? true : undefined}
        />
        {errors.logo ? <FieldError id={logoErrorId} announce={false}>{errors.logo}</FieldError> : null}
      </div>
      <ActionBar status={<FormFeedback state={state} />}>
        <Button type="submit" busy={isPending} aria-disabled={isPending || undefined} className="min-h-12">
          {isPending ? "Guardando…" : submitLabel}
        </Button>
      </ActionBar>
    </form>
  );
}
