"use client";

import { useId } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SwitchField } from "@/components/ui/switch";
import type { ActionResult } from "@/interface/admin/action-result";
import { SPONSOR_FIELD_MESSAGES } from "@/interface/admin/field-messages";

import { ActionBar, Field, FieldError, FormFeedback } from "../../_components/form-parts";
import { PUBLISHED_MESSAGE, PublishPreview, usePublishFlow } from "../../_components/publish-preview";
import { useControlledForm } from "../../_components/use-controlled-form";
import { SPONSOR_PUBLISH_FIELDS, SponsorPreview } from "./sponsor-preview";

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
  /** An edit page of a draft: it saves by itself once the typing stops (never on a create page). */
  autosave?: boolean;
  hasLogo?: boolean;
  /** The stored logo's address, so the preview before publishing shows it. */
  logoUrl?: string | null;
}

export function SponsorForm({ action, submitLabel, initialValues = EMPTY_SPONSOR_FORM_VALUES, autosave = false, hasLogo = false, logoUrl = null }: SponsorFormProps) {
  const { values, stored, bind, toggle, handleSubmit, review, submit, state, isPending, errors, formRef, autosaveStatus } = useControlledForm(action, initialValues, { fieldMessages: SPONSOR_FIELD_MESSAGES, autosave });
  // A published sponsor asks first, with the preview; a draft saves as it always did.
  const publishing = values.isPublished;
  const publish = usePublishFlow({ state, review, submit });
  const logoErrorId = `${useId()}-logo-error`;
  const logo = logoUrl ? { url: logoUrl } : null;

  return (
    <form ref={formRef} onSubmit={publishing ? publish.ask : handleSubmit} noValidate className="grid gap-5">
      <div className="grid gap-x-4 gap-y-5 @xl:grid-cols-2">
        <Field label="Nombre" count={{ length: values.name.length, max: 60 }} error={errors.name}>
          {(control) => <Input {...control} {...bind("name")} required maxLength={60} />}
        </Field>
        <Field label="Enlace (opcional)" help="Empieza con https://. Vacío: el logo sin enlace." count={{ length: values.url.length, max: 300 }} error={errors.url}>
          {(control) => <Input {...control} {...bind("url")} type="url" inputMode="url" maxLength={300} />}
        </Field>
      </div>
      {hasLogo ? (
        <Field label="Descripción del logo" help="Para quien no ve el logo." count={{ length: values.logoAlt.length, max: 200 }} error={errors.logoAlt}>
          {(control) => <Input {...control} {...bind("logoAlt")} required maxLength={200} />}
        </Field>
      ) : null}
      <div className="grid gap-1">
        <SwitchField
          label="Publicado"
          description={hasLogo ? undefined : "Sin logo no se puede publicar: suba el logo primero."}
          {...toggle("isPublished")}
          aria-describedby={errors.logo ? logoErrorId : undefined}
          aria-invalid={errors.logo ? true : undefined}
        />
        {errors.logo ? <FieldError id={logoErrorId} announce={false}>{errors.logo}</FieldError> : null}
      </div>
      <ActionBar status={<FormFeedback state={state} autosave={autosaveStatus} savedMessage={stored.isPublished ? PUBLISHED_MESSAGE : undefined} />}>
        <Button type="submit" busy={isPending} aria-disabled={isPending || undefined} className="min-h-12">
          {isPending ? "Guardando…" : publishing ? "Publicar" : submitLabel}
        </Button>
      </ActionBar>
      {publish.open ? (
        <PublishPreview
          before={stored.isPublished ? stored : null}
          after={values}
          fields={SPONSOR_PUBLISH_FIELDS}
          render={(shown, changed) => <SponsorPreview values={shown} logo={logo} changed={changed} />}
          {...publish.dialog}
        />
      ) : null}
    </form>
  );
}
