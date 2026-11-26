"use client";

import { useId, type ReactNode } from "react";

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
  /** An edit page of a draft: it saves by itself once the typing stops (never on a create page). */
  autosave?: boolean;
  hasImage?: boolean;
  /** The stored image's address, so the preview before publishing shows it. */
  imageUrl?: string | null;
}

/**
 * One group of the form: an 18px heading with its purpose on the same line, then its fields on a 12-column grid
 * (dirección 02, as in the event editor). The grid starts at `@xl`, the width this one-column form reaches.
 */
function FormGroup({ title, purpose, children }: { title: string; purpose?: string; children: ReactNode }) {
  const id = useId();

  return (
    <section aria-labelledby={id} className="min-w-0">
      <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 id={id} className="text-lg leading-[1.3] font-bold font-stretch-semi-expanded">
          {title}
        </h2>
        {purpose ? <span className="text-[0.8125rem] text-mist">{purpose}</span> : null}
      </div>
      <div className="grid gap-4 @xl:grid-cols-12">{children}</div>
    </section>
  );
}

export function PillarForm({ action, submitLabel, initialValues = EMPTY_PILLAR_FORM_VALUES, autosave = false, hasImage = false, imageUrl = null }: PillarFormProps) {
  const { values, stored, bind, toggle, handleSubmit, review, submit, state, isPending, errors, formRef, autosaveStatus } = useControlledForm(action, initialValues, { fieldMessages: PILLAR_FIELD_MESSAGES, autosave });
  // A published pillar asks first, with the preview; a draft saves as it always did.
  const publishing = values.isPublished;
  const publish = usePublishFlow({ state, review, submit });
  const image = imageUrl ? { url: imageUrl } : null;

  return (
    <form ref={formRef} onSubmit={publishing ? publish.ask : handleSubmit} noValidate className="grid">
      <div className="grid gap-10">
        {/* Spans by data type: word and title are short text (6 + 6), the text and the image's description full rows. */}
        <FormGroup title="Contenido" purpose="La tarjeta del pilar en la portada">
          <Field label="Palabra" help="La palabra grande de la tarjeta, por ejemplo «VOZ»." count={{ length: values.word.length, max: 20 }} error={errors.word} className="@xl:col-span-6">
            {(control) => <Input {...control} {...bind("word")} required maxLength={20} />}
          </Field>
          <Field label="Título" count={{ length: values.title.length, max: 60 }} error={errors.title} className="@xl:col-span-6">
            {(control) => <Input {...control} {...bind("title")} required maxLength={60} />}
          </Field>
          <Field label="Texto" count={{ length: values.text.length, max: 300 }} error={errors.text} className="@xl:col-span-12">
            {(control) => <Textarea {...control} {...bind("text")} rows={4} required maxLength={300} />}
          </Field>
          {hasImage ? (
            <Field label="Descripción de la imagen" help="Para quien no ve la imagen." count={{ length: values.imageAlt.length, max: 200 }} error={errors.imageAlt} className="@xl:col-span-12">
              {(control) => <Input {...control} {...bind("imageAlt")} required maxLength={200} />}
            </Field>
          ) : null}
        </FormGroup>
        <FormGroup title="Publicación">
          <SwitchField label="Publicado" className="@xl:col-span-12" {...toggle("isPublished")} />
        </FormGroup>
      </div>
      <ActionBar className="mt-6" status={<FormFeedback state={state} autosave={autosaveStatus} savedMessage={stored.isPublished ? PUBLISHED_MESSAGE : undefined} />}>
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
