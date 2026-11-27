"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FORUM_CATEGORY_DESCRIPTION_MAX_LENGTH, FORUM_CATEGORY_NAME_MAX_LENGTH } from "@/domain/forum";
import { FORUM_CATEGORY_FIELD_MESSAGES } from "@/interface/admin/field-messages";
import { createForumCategory, updateForumCategory } from "@/interface/admin/forum/actions";

import { EditorGroup, SPAN } from "../../../_components/editor-split";
import { ActionBar, Field, FormFeedback, GuardedBackLink } from "../../../_components/form-parts";
import { SectionTitle } from "../../../_components/section-title";
import { useToast } from "../../../_components/toast";
import { useControlledForm } from "../../../_components/use-controlled-form";

export const CATEGORIES_PATH = "/admin/foro/categorias";

/** The fixed part of a category's public address, shown before the slug field and in the «En el foro» card. */
const ADDRESS_PREFIX = "/foro?categoria=";

export interface CategoryFormValues {
  name: string;
  description: string;
  slug: string;
}

const EMPTY_VALUES: CategoryFormValues = { name: "", description: "", slug: "" };

type CategoryFormProps = { mode: "create" } | { mode: "edit"; id: string; initialValues: CategoryFormValues; threadCount: number };

interface CategoryHeaderProps {
  title: string;
  status?: string;
  description?: string;
}

/**
 * The head of a category page: back link, the «Categoría del foro» eyebrow over the name, and on a create page its
 * status and purpose. The title keeps the size and the slots of the admin's page header.
 */
export function CategoryHeader({ title, status, description }: CategoryHeaderProps) {
  return (
    <header data-slot="page-header" className="grid gap-y-3">
      <div>
        <GuardedBackLink href={CATEGORIES_PATH}>Volver a categorías</GuardedBackLink>
      </div>
      <div className="min-w-0">
        <p className="text-[0.8125rem] font-bold font-stretch-[118%] tracking-[0.12em] text-mist uppercase">Categoría del foro</p>
        <h1 className="mt-1 font-display text-[2rem] leading-[1.1] -tracking-[0.01em] text-balance wrap-anywhere md:text-[2.5rem]">{title}</h1>
        {status ? <p className="mt-1.5 font-mono text-[0.8125rem] wrap-anywhere text-mist">{status}</p> : null}
        {description ? <p className="mt-3 max-w-3xl text-mist">{description}</p> : null}
      </div>
    </header>
  );
}

/**
 * One column of fields at one width, and beside it on lg+ the «En el foro» card: what the category already has (its
 * threads, then its address) and the one button, sticky while the page scrolls. A new category has neither, so its
 * card is the button alone. On a phone the side wrapper dissolves (`contents`): the facts are a card after the fields
 * and the save bar sticks at the foot of the screen along the whole form.
 */
export function CategoryForm(props: CategoryFormProps) {
  const router = useRouter();
  const { notify } = useToast();
  const factsId = useId();
  const editing = props.mode === "edit";
  const action = props.mode === "edit" ? updateForumCategory.bind(null, props.id) : createForumCategory;
  const { values, bind, handleSubmit, state, isPending, errors } = useControlledForm(action, props.mode === "edit" ? props.initialValues : EMPTY_VALUES, {
    fieldMessages: FORUM_CATEGORY_FIELD_MESSAGES,
  });
  const created = !editing && state?.success === true;

  // A new category has nothing left to edit: confirm it and go back to the list, where it now shows.
  useEffect(() => {
    if (!created) return;

    notify("Categoría creada.");
    router.push(CATEGORIES_PATH);
  }, [created, notify, router]);

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="@container min-w-0">
        <EditorGroup title="Cómo aparece en el foro" purpose="Lo que leen los estudiantes al elegir dónde abrir un hilo">
          <Field label="Nombre" error={errors.name} className={SPAN.row}>
            {(control) => <Input {...control} {...bind("name")} required maxLength={FORUM_CATEGORY_NAME_MAX_LENGTH} className="text-xl font-semibold" />}
          </Field>
          <Field
            label="Descripción (opcional)"
            count={{ length: values.description.length, max: FORUM_CATEGORY_DESCRIPTION_MAX_LENGTH }}
            hint={editing ? `Hasta ${FORUM_CATEGORY_DESCRIPTION_MAX_LENGTH} caracteres. Si la deja vacía, se conserva la actual.` : `Hasta ${FORUM_CATEGORY_DESCRIPTION_MAX_LENGTH} caracteres. Los estudiantes la ven junto al nombre.`}
            error={errors.description}
            className={SPAN.row}
          >
            {(control) => <Textarea {...control} {...bind("description")} rows={3} maxLength={FORUM_CATEGORY_DESCRIPTION_MAX_LENGTH} />}
          </Field>
          <Field
            label="Dirección (opcional)"
            hint={
              editing
                ? "Minúsculas, números y guiones. Si la deja vacía, se conserva la actual. Cambiarla rompe los enlaces que ya apuntan a esta categoría."
                : "Minúsculas, números y guiones. Si la deja vacía, se genera a partir del nombre."
            }
            error={errors.slug}
            className={SPAN.row}
          >
            {(control) => (
              // The fixed prefix sits inside the field, so it reads which part is edited; the slug starts 16ch in (mono).
              <div className="relative font-mono text-[0.9375rem]">
                <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-mist">
                  {ADDRESS_PREFIX}
                </span>
                <Input
                  {...control}
                  {...bind("slug")}
                  autoCapitalize="off"
                  autoComplete="off"
                  spellCheck={false}
                  className="pl-[calc(0.75rem+16ch)] aria-[invalid=true]:pl-[calc(0.75rem-1px+16ch)]"
                />
              </div>
            )}
          </Field>
        </EditorGroup>
      </div>

      <div data-slot="category-side" className="contents lg:sticky lg:top-22 lg:grid lg:gap-4 lg:rounded-card lg:bg-card lg:p-5 lg:ring-1 lg:ring-paper-ring lg:ring-inset">
        {props.mode === "edit" ? (
          <section aria-labelledby={factsId} className="grid min-w-0 gap-4 rounded-card bg-card p-4 ring-1 ring-paper-ring ring-inset md:p-5 lg:contents">
            <SectionTitle id={factsId} className="border-b border-border pb-3">
              En el foro
            </SectionTitle>
            <dl className="grid gap-3">
              <div className="grid gap-0.5">
                <dt className="text-[0.8125rem] font-semibold text-mist">Hilos en la categoría</dt>
                <dd className="font-display text-[2.5rem] leading-[1.1] tabular-nums">
                  {props.threadCount}
                  <span className="ml-1.5 font-sans text-sm font-semibold font-stretch-normal text-mist">{props.threadCount === 1 ? "hilo" : "hilos"}</span>
                </dd>
              </div>
              <div className="grid gap-0.5">
                <dt className="text-[0.8125rem] font-semibold text-mist">Dirección actual</dt>
                <dd className="font-mono text-sm leading-[1.4] wrap-anywhere text-sky">
                  {ADDRESS_PREFIX}
                  {props.initialValues.slug}
                </dd>
              </div>
            </dl>
            <hr className="hidden border-0 border-t border-border lg:block" />
          </section>
        ) : null}
        {/* A new category gets its own "Categoría creada." toast above. */}
        <ActionBar
          className="mx-0 mt-0 rounded-card md:mx-0 lg:static lg:m-0 lg:grid-cols-1 lg:gap-3 lg:bg-transparent lg:p-0 lg:shadow-none lg:[&>[data-slot=form-feedback]:empty]:hidden"
          status={<FormFeedback state={state} toast={editing} />}
        >
          <Button type="submit" busy={isPending} aria-disabled={isPending || undefined} className="min-h-12 lg:w-full">
            {isPending ? "Guardando…" : editing ? "Guardar cambios" : "Crear categoría"}
          </Button>
        </ActionBar>
      </div>
    </form>
  );
}
