"use client";

import { Fragment, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SwitchField } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/interface/admin/action-result";

import { ActionBar, Field, FormFeedback } from "../../_components/form-parts";
import { FormColumns, Panel } from "../../_components/page-head";
import { useControlledForm } from "../../_components/use-controlled-form";
import { NewsPreview } from "./news-preview";

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
}

export const EMPTY_NEWS_FORM_VALUES: NewsFormValues = { title: "", slug: "", summary: "", body: "", publishedAt: "", coverAlt: "", isPublished: false };

interface NewsFormProps {
  action: (prevState: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  submitLabel: string;
  initialValues?: NewsFormValues;
  isEditing?: boolean;
  cover?: { url: string; width: number; height: number } | null;
  /** What goes above the preview in the right column: the cover panel on edit, a note on create. */
  asideTop: ReactNode;
}

const MARKDOWN_HELP = "Separe los párrafos con una línea en blanco. **negrita**, *cursiva*, [texto](https://enlace) y listas con «- » al inicio de cada línea.";

/** The form owns the values, so the preview in the right column lives here too and follows every keystroke. */
export function NewsForm({ action, submitLabel, initialValues = EMPTY_NEWS_FORM_VALUES, isEditing = false, cover = null, asideTop }: NewsFormProps) {
  const { bind, toggle, handleSubmit, state, isPending, errors } = useControlledForm(action, initialValues);
  const values = { title: bind("title").value, summary: bind("summary").value, body: bind("body").value, publishedAt: bind("publishedAt").value };

  return (
    <FormColumns
      stickyAside
      aside={
        <>
          {/* Keyed: React flags a node handed down from the page when it sits beside a sibling without one. */}
          <Fragment key="top">{asideTop}</Fragment>
          <div key="preview" className="lg:sticky lg:top-8">
            <NewsPreview values={values} cover={cover} coverAlt={bind("coverAlt").value} />
          </div>
        </>
      }
    >
      <Panel aria-label="Datos de la noticia">
        <form onSubmit={handleSubmit} noValidate className="grid gap-5">
          <Field label="Título" hint="Hasta 120 caracteres." error={errors.title}>
            {(control) => <Input {...control} {...bind("title")} required maxLength={120} />}
          </Field>
          <Field label="Resumen" hint="Una o dos frases para la lista. Hasta 280 caracteres." error={errors.summary}>
            {(control) => <Textarea {...control} {...bind("summary")} rows={3} required maxLength={280} />}
          </Field>
          <Field label="Texto" hint={MARKDOWN_HELP} error={errors.body}>
            {(control) => <Textarea {...control} {...bind("body")} rows={14} required maxLength={10000} />}
          </Field>
          <div className="grid gap-x-4 gap-y-5 @xl:grid-cols-2">
            <Field label="Fecha de publicación" hint={isEditing ? "La fecha que se muestra en el sitio." : "Déjela vacía para usar la de hoy."} error={errors.publishedAt}>
              {(control) => <Input {...control} {...bind("publishedAt")} type="date" />}
            </Field>
            <Field
              label="Identificador (slug)"
              hint={isEditing ? "Cambiarlo cambia el enlace público de la noticia." : "Déjelo vacío para generarlo desde el título."}
              error={errors.slug}
            >
              {(control) => <Input {...control} {...bind("slug")} maxLength={80} />}
            </Field>
          </div>
          {cover ? (
            <Field label="Descripción de la foto de portada" hint="Obligatoria, para accesibilidad. Hasta 200 caracteres." error={errors.coverAlt}>
              {(control) => <Input {...control} {...bind("coverAlt")} required maxLength={200} />}
            </Field>
          ) : null}
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
      </Panel>
    </FormColumns>
  );
}
