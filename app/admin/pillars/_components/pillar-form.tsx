"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SwitchField } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/interface/admin/action-result";
import { PILLAR_FIELD_MESSAGES } from "@/interface/admin/field-messages";

import { ActionBar, Field, FormFeedback } from "../../_components/form-parts";
import { PUBLISHED_MESSAGE, PublishPreview, usePublishFlow } from "../../_components/publish-preview";
import { useControlledForm } from "../../_components/use-controlled-form";
import { PILLAR_PUBLISH_FIELDS, PillarPreview } from "./pillar-preview";

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
  /** The stored image's address, so the preview before publishing shows it. */
  imageUrl?: string | null;
}

export function PillarForm({ action, submitLabel, initialValues = EMPTY_PILLAR_FORM_VALUES, hasImage = false, imageUrl = null }: PillarFormProps) {
  const { values, stored, bind, toggle, handleSubmit, review, submit, state, isPending, errors } = useControlledForm(action, initialValues, { fieldMessages: PILLAR_FIELD_MESSAGES });
  // A published pillar asks first, with the preview; a draft saves as it always did.
  const publishing = values.isPublished;
  const publish = usePublishFlow({ state, review, submit });
  const image = imageUrl ? { url: imageUrl } : null;

  return (
    <form onSubmit={publishing ? publish.ask : handleSubmit} noValidate className="grid gap-5">
      <div className="grid gap-x-4 gap-y-5 @xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Field label="Palabra" help="La palabra grande de la tarjeta, por ejemplo «VOZ»." count={{ length: values.word.length, max: 20 }} error={errors.word}>
          {(control) => <Input {...control} {...bind("word")} required maxLength={20} />}
        </Field>
        <Field label="Título" count={{ length: values.title.length, max: 60 }} error={errors.title}>
          {(control) => <Input {...control} {...bind("title")} required maxLength={60} />}
        </Field>
      </div>
      <Field label="Texto" count={{ length: values.text.length, max: 300 }} error={errors.text}>
        {(control) => <Textarea {...control} {...bind("text")} rows={4} required maxLength={300} />}
      </Field>
      {hasImage ? (
        <Field label="Descripción de la imagen" help="Para quien no ve la imagen." count={{ length: values.imageAlt.length, max: 200 }} error={errors.imageAlt}>
          {(control) => <Input {...control} {...bind("imageAlt")} required maxLength={200} />}
        </Field>
      ) : null}
      <SwitchField label="Publicado" {...toggle("isPublished")} />
      <ActionBar status={<FormFeedback state={state} savedMessage={stored.isPublished ? PUBLISHED_MESSAGE : undefined} />}>
        <Button type="submit" busy={isPending} aria-disabled={isPending || undefined} className="min-h-12">
          {isPending ? "Guardando…" : publishing ? "Publicar" : submitLabel}
        </Button>
      </ActionBar>
      {publish.open ? (
        <PublishPreview
          before={stored.isPublished ? stored : null}
          after={values}
          fields={PILLAR_PUBLISH_FIELDS}
          render={(shown, changed) => <PillarPreview values={shown} image={image} changed={changed} />}
          {...publish.dialog}
        />
      ) : null}
    </form>
  );
}
