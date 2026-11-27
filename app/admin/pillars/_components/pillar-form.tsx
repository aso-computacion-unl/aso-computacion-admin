"use client";

import { Input } from "@/components/ui/input";
import { SwitchField } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { PILLAR_FIELD_MESSAGES } from "@/interface/admin/field-messages";

import { EditorGroup, SPAN } from "../../_components/editor-split";
import { ActionBar, Field, FormFeedback } from "../../_components/form-parts";
import { PUBLISHED_MESSAGE, PublishPreview, PublishSubmitButton, usePublishFlow, type PublishFormProps } from "../../_components/publish-preview";
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

interface PillarFormProps extends PublishFormProps<PillarFormValues> {
  hasImage?: boolean;
  /** The stored image's address, so the preview before publishing shows it. */
  imageUrl?: string | null;
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
        <EditorGroup title="Contenido" purpose="La tarjeta del pilar en la portada">
          <Field label="Palabra" help="La palabra grande de la tarjeta, por ejemplo «VOZ»." count={{ length: values.word.length, max: 20 }} error={errors.word} className={SPAN.text}>
            {(control) => <Input {...control} {...bind("word")} required maxLength={20} />}
          </Field>
          <Field label="Título" count={{ length: values.title.length, max: 60 }} error={errors.title} className={SPAN.text}>
            {(control) => <Input {...control} {...bind("title")} required maxLength={60} />}
          </Field>
          <Field label="Texto" count={{ length: values.text.length, max: 300 }} error={errors.text} className={SPAN.row}>
            {(control) => <Textarea {...control} {...bind("text")} rows={4} required maxLength={300} />}
          </Field>
          {hasImage ? (
            <Field label="Descripción de la imagen" help="Para quien no ve la imagen." count={{ length: values.imageAlt.length, max: 200 }} error={errors.imageAlt} className={SPAN.row}>
              {(control) => <Input {...control} {...bind("imageAlt")} required maxLength={200} />}
            </Field>
          ) : null}
        </EditorGroup>
        <EditorGroup title="Publicación">
          <SwitchField label="Publicado" className={SPAN.row} {...toggle("isPublished")} />
        </EditorGroup>
      </div>
      <ActionBar className="mt-6" status={<FormFeedback state={state} autosave={autosaveStatus} savedMessage={stored.isPublished ? PUBLISHED_MESSAGE : undefined} />}>
        <PublishSubmitButton isPending={isPending} publishing={publishing} label={submitLabel} className="min-h-12" />
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
