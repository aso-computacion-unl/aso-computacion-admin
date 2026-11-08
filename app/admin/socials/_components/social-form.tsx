"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SwitchField } from "@/components/ui/switch";
import { SOCIAL_PLATFORMS } from "@/domain/social-link";
import type { ActionResult } from "@/interface/admin/action-result";
import { socialPlatformLabel } from "@/interface/admin/socials/platform-labels";

import { ActionBar, Field, FormFeedback } from "../../_components/form-parts";
import { MoreOptions } from "../../_components/more-options";
import { PUBLISHED_MESSAGE, PublishPreview, usePublishFlow } from "../../_components/publish-preview";
import { useControlledForm } from "../../_components/use-controlled-form";
import { SOCIAL_PUBLISH_FIELDS, SocialPreview } from "./social-preview";

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
  const { values, stored, bind, toggle, handleSubmit, review, submit, state, isPending, errors } = useControlledForm(action, initialValues);
  // A published link asks first, with the preview; a draft saves as it always did.
  const publishing = values.isPublished;
  const publish = usePublishFlow({ state, review, submit });
  const platform = bind("platform");
  const label = bind("label");

  /** Changing the platform renames the link only while its name is still the previous platform's own (or blank). */
  function choosePlatform(event: { target: { value: string } }) {
    const untouched = label.value.trim() === "" || label.value === socialPlatformLabel(platform.value);

    if (untouched) label.onChange({ target: { value: socialPlatformLabel(event.target.value) } });
    platform.onChange(event);
  }

  return (
    <form onSubmit={publishing ? publish.ask : handleSubmit} noValidate className="grid gap-5">
      <div className="grid gap-x-4 gap-y-5 @xl:grid-cols-2">
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
        <Field label="Nombre" count={{ length: values.label.length, max: 40 }} error={errors.label}>
          {(control) => <Input {...control} {...label} required maxLength={40} />}
        </Field>
        <Field label="Usuario" help="Por ejemplo «@aso_computacion»." count={{ length: values.handle.length, max: 60 }} error={errors.handle}>
          {(control) => <Input {...control} {...bind("handle")} required maxLength={60} />}
        </Field>
        <Field label="Enlace" help="Empieza con https://." error={errors.url}>
          {(control) => <Input type="url" inputMode="url" {...control} {...bind("url")} required />}
        </Field>
      </div>
      <MoreOptions invalid={Boolean(errors.note || errors.blurb)}>
        <Field label="Nota (opcional)" help="Etiqueta corta junto a la red." count={{ length: values.note.length, max: 40 }} error={errors.note}>
          {(control) => <Input {...control} {...bind("note")} maxLength={40} />}
        </Field>
        <Field label="Descripción corta (opcional)" count={{ length: values.blurb.length, max: 80 }} error={errors.blurb}>
          {(control) => <Input {...control} {...bind("blurb")} maxLength={80} />}
        </Field>
      </MoreOptions>
      <SwitchField label="Publicada" {...toggle("isPublished")} />
      <ActionBar status={<FormFeedback state={state} savedMessage={stored.isPublished ? PUBLISHED_MESSAGE : undefined} />}>
        <Button type="submit" busy={isPending} aria-disabled={isPending || undefined} className="min-h-12">
          {isPending ? "Guardando…" : publishing ? "Publicar" : submitLabel}
        </Button>
      </ActionBar>
      {publish.open ? (
        <PublishPreview
          before={stored.isPublished ? stored : null}
          after={values}
          fields={SOCIAL_PUBLISH_FIELDS}
          render={(shown, changed) => <SocialPreview values={shown} changed={changed} />}
          {...publish.dialog}
        />
      ) : null}
    </form>
  );
}
