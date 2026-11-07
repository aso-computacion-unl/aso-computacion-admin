"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SwitchField } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/interface/admin/action-result";
import { NEWS_FIELD_MESSAGES } from "@/interface/admin/field-messages";

import { ActionBar, Field, FormFeedback } from "../../_components/form-parts";
import { MoreOptions } from "../../_components/more-options";
import { PUBLISHED_MESSAGE, PublishPreview, usePublishFlow } from "../../_components/publish-preview";
import { ScheduleFields } from "../../_components/schedule-fields";
import { useControlledForm } from "../../_components/use-controlled-form";
import { NEWS_PUBLISH_FIELDS, NewsPreview } from "./news-preview";

export interface NewsFormValues {
  title: string;
  slug: string;
  summary: string;
  body: string;
  /** YYYY-MM-DD; blank on create means today (the server fills it in). */
  publishedAt: string;
  /** Alt of the current cover; the field shows only when `cover` exists, and a blank one is ignored without a cover. */
  coverAlt: string;
  isPublished: boolean;
  /** `YYYY-MM-DDTHH:mm` in Ecuador time, or blank for no start. Not `publishedAt`: that is only the date the site shows. */
  publishAt: string;
  /** `YYYY-MM-DDTHH:mm` in Ecuador time, or blank for no end. */
  unpublishAt: string;
}

export const EMPTY_NEWS_FORM_VALUES: NewsFormValues = {
  title: "",
  slug: "",
  summary: "",
  body: "",
  publishedAt: "",
  coverAlt: "",
  isPublished: false,
  publishAt: "",
  unpublishAt: "",
};

interface NewsFormProps {
  action: (prevState: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  submitLabel: string;
  initialValues?: NewsFormValues;
  /** An edit page of a draft: it saves by itself once the typing stops (never on a create page). */
  autosave?: boolean;
  isEditing?: boolean;
  /** The stored cover, once the news item has one: its description is asked for here, and the preview shows it. */
  cover?: { url: string; width: number; height: number } | null;
}

const MARKDOWN_HELP = "Separe los párrafos con una línea en blanco. **negrita**, *cursiva*, [texto](https://enlace) y listas con «- » al inicio de cada línea.";

/** The fields under "Más opciones": an error in one of them opens it. */
const MORE_OPTIONS_FIELDS = ["publishedAt", "slug", "publishAt", "unpublishAt"] as const;

export function NewsForm({ action, submitLabel, initialValues = EMPTY_NEWS_FORM_VALUES, autosave = false, isEditing = false, cover = null }: NewsFormProps) {
  const { values, stored, bind, toggle, handleSubmit, review, submit, state, isPending, errors, formRef, autosaveStatus } = useControlledForm(action, initialValues, { fieldMessages: NEWS_FIELD_MESSAGES, autosave });
  // A published item asks first, with the preview; a draft saves as it always did.
  const publishing = values.isPublished;
  const publish = usePublishFlow({ state, review, submit });
  const moreOptionsInvalid = MORE_OPTIONS_FIELDS.some((name) => errors[name]);

  return (
    <form ref={formRef} onSubmit={publishing ? publish.ask : handleSubmit} noValidate className="grid gap-5">
      <Field label="Título" count={{ length: values.title.length, max: 120 }} error={errors.title}>
        {(control) => <Input {...control} {...bind("title")} required maxLength={120} className="text-lg" />}
      </Field>
      <Field label="Resumen" count={{ length: values.summary.length, max: 280 }} error={errors.summary}>
        {(control) => <Textarea {...control} {...bind("summary")} rows={3} required maxLength={280} />}
      </Field>
      <Field label="Texto" help={MARKDOWN_HELP} count={{ length: values.body.length, max: 10000 }} error={errors.body}>
        {(control) => <Textarea {...control} {...bind("body")} rows={12} required maxLength={10000} />}
      </Field>
      {cover ? (
        <Field label="Descripción de la foto de portada" count={{ length: values.coverAlt.length, max: 200 }} error={errors.coverAlt}>
          {(control) => <Input {...control} {...bind("coverAlt")} required maxLength={200} />}
        </Field>
      ) : null}
      <MoreOptions invalid={moreOptionsInvalid}>
        <Field label="Fecha de publicación" help={isEditing ? "La fecha que se muestra en el sitio." : "Vacío: la de hoy."} error={errors.publishedAt}>
          {(control) => <Input {...control} {...bind("publishedAt")} type="date" />}
        </Field>
        <Field
          label="Identificador (slug)"
          help={isEditing ? "Cambiarlo cambia el enlace público de la noticia." : "Vacío: se genera desde el título."}
          error={errors.slug}
        >
          {(control) => <Input {...control} {...bind("slug")} maxLength={80} />}
        </Field>
        <ScheduleFields publishAt={bind("publishAt")} unpublishAt={bind("unpublishAt")} errors={errors} />
      </MoreOptions>
      <SwitchField label="Publicada" {...toggle("isPublished")} />
      <ActionBar status={<FormFeedback state={state} autosave={autosaveStatus} savedMessage={stored.isPublished ? PUBLISHED_MESSAGE : undefined} />}>
        <Button type="submit" busy={isPending} aria-disabled={isPending || undefined} className="min-h-12">
          {isPending ? "Guardando…" : publishing ? "Publicar" : submitLabel}
        </Button>
      </ActionBar>
      {publish.open ? (
        <PublishPreview
          before={stored.isPublished ? stored : null}
          after={values}
          fields={NEWS_PUBLISH_FIELDS}
          render={(shown, changed) => <NewsPreview values={shown} cover={cover} changed={changed} />}
          {...publish.dialog}
        />
      ) : null}
    </form>
  );
}
