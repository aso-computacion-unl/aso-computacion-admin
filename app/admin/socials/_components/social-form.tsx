"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SwitchField } from "@/components/ui/switch";
import { SOCIAL_PLATFORMS } from "@/domain/social-link";
import type { ActionResult } from "@/interface/admin/action-result";
import { socialPlatformLabel } from "@/interface/admin/socials/platform-labels";

import { EditorGroup, EditorSplit, SPAN } from "../../_components/editor-split";
import { Field, FormFeedback } from "../../_components/form-parts";
import { MoreOptions } from "../../_components/more-options";
import { PUBLISHED_MESSAGE, PublishPreview, usePublishFlow } from "../../_components/publish-preview";
import { useControlledForm } from "../../_components/use-controlled-form";
import { SOCIAL_PUBLISH_FIELDS, SocialCardPreview, SocialPreview } from "./social-preview";

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
  /** An edit page of a draft: it saves by itself once the typing stops (never on a create page). */
  autosave?: boolean;
  /** A note at the foot of the publish panel (a new link: where it lands in the list). */
  note?: string;
}

export function SocialForm({ action, submitLabel, initialValues = EMPTY_SOCIAL_FORM_VALUES, autosave = false, note }: SocialFormProps) {
  const { values, stored, bind, toggle, handleSubmit, review, submit, state, isPending, errors, formRef, autosaveStatus } = useControlledForm(action, initialValues, { autosave });
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
    <EditorSplit
      formRef={formRef}
      onSubmit={publishing ? publish.ask : handleSubmit}
      preview={<SocialCardPreview values={values} />}
      state={<SwitchField label="Publicada" {...toggle("isPublished")} />}
      note={note}
      status={<FormFeedback state={state} autosave={autosaveStatus} savedMessage={stored.isPublished ? PUBLISHED_MESSAGE : undefined} />}
      submit={
        <Button type="submit" busy={isPending} aria-disabled={isPending || undefined} className="min-h-12 lg:w-full">
          {isPending ? "Guardando…" : publishing ? "Publicar" : submitLabel}
        </Button>
      }
      dialog={
        publish.open ? (
          <PublishPreview
            before={stored.isPublished ? stored : null}
            after={values}
            fields={SOCIAL_PUBLISH_FIELDS}
            render={(shown, changed) => <SocialPreview values={shown} changed={changed} />}
            {...publish.dialog}
          />
        ) : null
      }
    >
      <EditorGroup title="Contenido" purpose="Cómo aparece en Redes">
        <Field label="Red" error={errors.platform} className={SPAN.text}>
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
        <Field label="Nombre" count={{ length: values.label.length, max: 40 }} error={errors.label} className={SPAN.text}>
          {(control) => <Input {...control} {...label} required maxLength={40} />}
        </Field>
        <Field label="Usuario" help="Por ejemplo «@aso_computacion»." count={{ length: values.handle.length, max: 60 }} error={errors.handle} className={SPAN.text}>
          {(control) => <Input {...control} {...bind("handle")} required maxLength={60} />}
        </Field>
        <Field label="Enlace" help="Empieza con https://." error={errors.url} className={SPAN.text}>
          {(control) => <Input type="url" inputMode="url" {...control} {...bind("url")} required />}
        </Field>
      </EditorGroup>
      <div className="grid min-w-0 gap-1.5">
        <MoreOptions invalid={Boolean(errors.note || errors.blurb)}>
          <Field label="Nota (opcional)" help="Etiqueta corta junto a la red." count={{ length: values.note.length, max: 40 }} error={errors.note}>
            {(control) => <Input {...control} {...bind("note")} maxLength={40} />}
          </Field>
          <Field label="Descripción corta (opcional)" count={{ length: values.blurb.length, max: 80 }} error={errors.blurb}>
            {(control) => <Input {...control} {...bind("blurb")} maxLength={80} />}
          </Field>
        </MoreOptions>
        <p className="text-[0.8125rem] text-mist">Nota y descripción corta.</p>
      </div>
    </EditorSplit>
  );
}
