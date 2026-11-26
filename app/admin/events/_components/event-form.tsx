"use client";

import Link from "next/link";
import { useId, type ComponentProps, type FormEvent, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { fieldClasses } from "@/components/ui/field-styles";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { SwitchField } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { ActionResult } from "@/interface/admin/action-result";
import {
  EMPTY_EVENT_FORM_VALUES,
  formValuesToFormData,
  type EventFormValues,
} from "@/interface/admin/events/event-form-values";

import { RegistrationSettingsFields } from "../../registrations/_components/registration-fields";
import { Panel } from "../../_components/form-layout";
import { ActionBar, Field, FieldError, FormFeedback } from "../../_components/form-parts";
import { MoreOptions } from "../../_components/more-options";
import { PUBLISHED_MESSAGE, PublishPreview, usePublishFlow } from "../../_components/publish-preview";
import { useControlledForm } from "../../_components/use-controlled-form";
import { EVENT_PUBLISH_FIELDS, EventCardPreview, EventPreview } from "./event-preview";

type EventFormAction = (prevState: ActionResult | null, formData: FormData) => Promise<ActionResult>;

interface EventFormProps {
  action: EventFormAction;
  submitLabel: string;
  initialValues?: EventFormValues;
  /** An edit page of a draft: it saves by itself once the typing stops (never on a create page). */
  autosave?: boolean;
  /** Where the event's registration is changed (Inscripciones), when it has one: a refused date points there. */
  registrationHref?: string;
  /** A new event whose kind is already chosen (Inscripciones creates only events with registration): no kind selector. */
  fixedKind?: "registration";
}

const TYPE_OPTIONS = [
  { value: "taller", label: "Taller" },
  { value: "charla", label: "Charla" },
  { value: "evento", label: "Evento" },
  { value: "comunidad", label: "Comunidad" },
  { value: "", label: "Sin tipo" },
] as const;

const KIND_OPTIONS = [
  { value: "announcement", label: "Evento" },
  { value: "registration", label: "Evento con inscripción" },
] as const;

const PRECISION_OPTIONS = [
  { value: "day", label: "Fecha exacta" },
  { value: "month", label: "Solo mes" },
] as const;

/** The fields under "Más opciones": an error in one of them opens it. */
const MORE_OPTIONS_FIELDS = ["commitMessage", "para", "linkUrl", "linkLabel", "highlights", "slug"] as const;

/** The fields under «Programar publicación y retiro» in the publish panel: an error in one of them opens it. */
const SCHEDULE_FIELDS = ["publishAt", "unpublishAt"] as const;

/**
 * A segmented control that hugs its options once its group is wide enough (the 12-column grid), and keeps the
 * even cells of `narrow` on a phone, where hugging cells would overflow.
 */
function hug(narrow: string) {
  return cn(narrow, "@2xl:inline-grid @2xl:grid-flow-col @2xl:grid-cols-none @2xl:auto-cols-max @2xl:[&>label>span]:px-4");
}

/** Spans of the 12-column grid by kind of data: a time 3, a place 6, the rest the full row. */
const SPAN = { time: "@2xl:col-span-3", text: "@2xl:col-span-6", row: "@2xl:col-span-12" } as const;

/** One group of the editor: an 18px heading with its purpose on the same line, then its fields on the 12-column grid. */
function EditorGroup({ title, purpose, inset = false, children }: { title: string; purpose?: string; inset?: boolean; children: ReactNode }) {
  const id = useId();

  return (
    <section aria-labelledby={id} className="min-w-0">
      <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 id={id} className="text-lg leading-[1.3] font-bold font-stretch-semi-expanded">
          {title}
        </h2>
        {purpose ? <span className="text-[0.8125rem] text-mist">{purpose}</span> : null}
      </div>
      {/* A conditional group (the registration) carries a 2px sky rule on its left. */}
      <div className={cn("grid gap-4 @2xl:grid-cols-12", inset && "border-l-2 border-sky pl-4")}>{children}</div>
    </section>
  );
}

/** A month-only date travels as the first of its month (YYYY-MM-01); the month input shows YYYY-MM. */
const MONTH_INPUT_PATTERN = /^\d{4}-\d{2}$/;

/** The commit message reads like a shell line: a fixed `$ ` in front of the text. */
function CommitInput({ className, ...props }: ComponentProps<"input">) {
  return (
    <span
      className={cn(
        fieldClasses,
        "flex items-center p-0 has-[input:focus-visible]:border-sky has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-1 has-[input:focus-visible]:outline-sky",
        props["aria-invalid"] && "px-0 py-0",
        className,
      )}
    >
      <span aria-hidden="true" className="pl-3 font-mono text-sm text-sky select-none">
        $
      </span>
      <input
        className="min-h-[calc(2.75rem-2px)] w-full min-w-0 bg-transparent px-2 py-2 font-mono text-sm text-sky outline-none placeholder:text-mist/80"
        {...props}
      />
    </span>
  );
}

/**
 * Controlled form: the values live in state and are submitted through
 * `startTransition`, never through `<form action>`, so a failed save keeps
 * everything the owner typed (React 19 resets uncontrolled fields after a
 * form action). `useControlledForm` does both, and checks every field before it submits.
 */
export function EventForm({ action, submitLabel, initialValues = EMPTY_EVENT_FORM_VALUES, autosave = false, registrationHref, fixedKind }: EventFormProps) {
  const { values, stored, setValues, bind, toggle, handleSubmit, review, submit, state, isPending, errors, formRef, autosaveStatus } = useControlledForm(action, fixedKind ? { ...initialValues, eventKind: fixedKind } : initialValues, {
    serialize: formValuesToFormData,
    autosave,
  });
  // A published event asks first, with the preview; a draft saves as it always did.
  const publishing = values.isPublished;
  const publish = usePublishFlow({ state, review, submit });
  const isEditing = initialValues.slug !== "";

  function handleFormSubmit(event: FormEvent<HTMLFormElement>) {
    return publishing ? publish.ask(event) : handleSubmit(event);
  }

  function setDatePrecision(datePrecision: string) {
    setValues((previous) => {
      const precision = datePrecision === "month" ? "month" : "day";
      const snapped = precision === "month" && previous.date.length === 10 ? `${previous.date.slice(0, 7)}-01` : previous.date;

      return { ...previous, datePrecision: precision, date: snapped };
    });
  }

  // A new «Evento con inscripción» has the cierre here; a new announcement sends none, so a cierre refused before the
  // kind switched is not its own. Editing, a date before the registration's cierre is refused on `registrationDeadline`,
  // which this form does not have (it is set in Inscripciones), so it shows on the date.
  const withRegistration = !isEditing && values.eventKind === "registration";
  const deadlineError = isEditing ? errors.registrationDeadline : undefined;
  const dateError = errors.date ?? (deadlineError ? `${deadlineError} Elija otra fecha o mueva el cierre en Inscripciones.` : undefined);
  const moreOptionsInvalid = MORE_OPTIONS_FIELDS.some((name) => errors[name]);

  const scheduleInvalid = SCHEDULE_FIELDS.some((name) => errors[name]);

  // Two zones: what the public reads on the left, what decides the publication (preview, state, schedule and the one
  // primary button) in a 22rem panel on the right that stays in view. On a phone the panel follows the content and
  // the side wrapper dissolves (`contents`), so the save bar sticks along the whole form, not only along the panel.
  return (
    <form ref={formRef} onSubmit={handleFormSubmit} noValidate className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <Panel className="grid gap-10">
        <EditorGroup title="Contenido" purpose="Lo que el público lee">
          {isEditing || fixedKind ? null : (
            <Segmented
              legend="Tipo de evento"
              name="eventKind"
              value={values.eventKind}
              options={KIND_OPTIONS}
              columnsClassName={hug("grid-cols-1 sm:grid-cols-2")}
              onChange={(eventKind) => setValues((previous) => ({ ...previous, eventKind: eventKind === "registration" ? "registration" : "announcement" }))}
              className={SPAN.row}
            />
          )}
          <Field label="Título" count={{ length: values.title.length, max: 120 }} error={errors.title} className={SPAN.row}>
            {(control) => <Input {...control} {...bind("title")} required maxLength={120} className="text-xl font-[650]" />}
          </Field>
          <div className={cn("grid min-w-0 content-start gap-1.5", SPAN.row)}>
            <Segmented
              legend="Tipo"
              name="type"
              value={values.type}
              options={TYPE_OPTIONS}
              columnsClassName={hug("grid-cols-3 sm:grid-cols-5")}
              onChange={(type) => setValues((previous) => ({ ...previous, type }))}
              aria-describedby={errors.type ? "type-error" : undefined}
              aria-invalid={errors.type ? true : undefined}
            />
            {errors.type ? <FieldError id="type-error" announce={false}>{errors.type}</FieldError> : null}
          </div>
          <Field label="Descripción" count={{ length: values.description.length, max: 600 }} error={errors.description} className={SPAN.row}>
            {(control) => <Textarea {...control} {...bind("description")} rows={4} maxLength={600} />}
          </Field>
        </EditorGroup>

        <EditorGroup title="Cuándo y dónde">
          <div className={cn("grid min-w-0 content-start gap-1.5", SPAN.time)}>
            <Field label={values.datePrecision === "month" ? "Mes" : "Fecha"} error={dateError}>
              {(control) =>
                values.datePrecision === "month" ? (
                  <Input
                    {...control}
                    name="date"
                    type="month"
                    value={values.date.length === 10 ? values.date.slice(0, 7) : values.date}
                    onChange={(event) =>
                      setValues((previous) => ({
                        ...previous,
                        date: MONTH_INPUT_PATTERN.test(event.target.value) ? `${event.target.value}-01` : event.target.value,
                      }))
                    }
                  />
                ) : (
                  <Input {...control} {...bind("date")} type="date" />
                )
              }
            </Field>
            {deadlineError && registrationHref ? (
              <Link href={registrationHref} className="justify-self-start text-sm font-semibold underline underline-offset-4">
                Gestionar inscripción
              </Link>
            ) : null}
          </div>
          <Field label="Hora" count={{ length: values.hora.length, max: 80 }} error={errors.hora} className={SPAN.time}>
            {(control) => <Input {...control} {...bind("hora")} maxLength={80} />}
          </Field>
          <Field label="Lugar" count={{ length: values.lugar.length, max: 80 }} error={errors.lugar} className={SPAN.text}>
            {(control) => <Input {...control} {...bind("lugar")} maxLength={80} />}
          </Field>
          <div className={cn("grid min-w-0 content-start gap-1.5", SPAN.row)}>
            <Segmented
              legend="Tipo de fecha"
              name="datePrecision"
              value={values.datePrecision}
              options={PRECISION_OPTIONS}
              columnsClassName={hug("grid-cols-2")}
              onChange={setDatePrecision}
              aria-describedby={errors.datePrecision ? "datePrecision-error" : undefined}
              aria-invalid={errors.datePrecision ? true : undefined}
            />
            {errors.datePrecision ? <FieldError id="datePrecision-error" announce={false}>{errors.datePrecision}</FieldError> : null}
          </div>
        </EditorGroup>

        {withRegistration ? (
          <EditorGroup title="Inscripción" purpose="Cómo se anotan y cuántos entran" inset>
            <div className={cn("min-w-0", SPAN.row)}>
              <RegistrationSettingsFields
                legend="Quién se inscribe"
                mode={values.registrationMode}
                onModeChange={(mode) => setValues((previous) => ({ ...previous, registrationMode: mode === "open" ? "open" : "unl" }))}
                capacity={bind("registrationCapacity")}
                deadline={bind("registrationDeadline")}
                errors={errors}
              />
            </div>
          </EditorGroup>
        ) : null}

        <div className="grid min-w-0 gap-1.5">
          <MoreOptions invalid={moreOptionsInvalid}>
            <Field label="Para quién" count={{ length: values.para.length, max: 80 }} error={errors.para} className="@xl:col-span-2">
              {(control) => <Input {...control} {...bind("para")} maxLength={80} />}
            </Field>
            <Field label="Enlace" error={errors.linkUrl}>
              {(control) => <Input {...control} {...bind("linkUrl")} type="url" inputMode="url" />}
            </Field>
            <Field label="Texto del enlace" count={{ length: values.linkLabel.length, max: 80 }} error={errors.linkLabel}>
              {(control) => <Input {...control} {...bind("linkLabel")} maxLength={80} />}
            </Field>
            <Field label="Puntos destacados" help="Uno por línea, hasta 8 de 80 caracteres." error={errors.highlights} className="@xl:col-span-2">
              {(control) => <Textarea {...control} {...bind("highlights")} rows={4} />}
            </Field>
            <Field label="Mensaje de commit" count={{ length: values.commitMessage.length, max: 80 }} error={errors.commitMessage} className="@xl:col-span-2">
              {(control) => <CommitInput {...control} {...bind("commitMessage")} maxLength={80} />}
            </Field>
            <Field
              label="Identificador (slug)"
              help={isEditing ? "Cambiarlo cambia el enlace público del evento." : "Vacío: se genera desde el título."}
              error={errors.slug}
              className="@xl:col-span-2"
            >
              {(control) => <Input {...control} {...bind("slug")} maxLength={80} />}
            </Field>
          </MoreOptions>
          <p className="text-[0.8125rem] text-mist">Para quién, enlace, puntos destacados, mensaje de commit e identificador.</p>
        </div>
      </Panel>

      <div className="contents lg:sticky lg:top-22 lg:block">
        <Panel aria-label="Publicación" className="grid gap-4 lg:rounded-b-none">
          <h2 className="text-lg leading-[1.3] font-bold font-stretch-semi-expanded">Publicación</h2>
          <EventCardPreview values={values} withRegistration={withRegistration} />
          <hr className="border-0 border-t border-border" />
          <SwitchField label="Publicado" {...toggle("isPublished")} />
          <SwitchField label="Destacado" {...toggle("featured")} />
          <MoreOptions summary="Programar publicación y retiro" invalid={scheduleInvalid}>
            <Field label="Publicar el" help="Hora de Ecuador. Vacío: sale de inmediato." error={errors.publishAt}>
              {(control) => <Input {...control} {...bind("publishAt")} type="datetime-local" />}
            </Field>
            <Field label="Retirar el" help="Hora de Ecuador. Vacío: no se retira." error={errors.unpublishAt}>
              {(control) => <Input {...control} {...bind("unpublishAt")} type="datetime-local" />}
            </Field>
          </MoreOptions>
          {isEditing ? null : <p className="text-[0.8125rem] text-mist">Las fotos se agregan después de crear el evento.</p>}
        </Panel>
        <ActionBar
          className="mx-0 mt-0 rounded md:mx-0 lg:mb-0 lg:grid-cols-1 lg:gap-3 lg:rounded-t-none"
          status={<FormFeedback state={state} autosave={autosaveStatus} savedMessage={stored.isPublished ? PUBLISHED_MESSAGE : undefined} />}
        >
          <Button type="submit" busy={isPending} aria-disabled={isPending || undefined} className="min-h-12 lg:w-full">
            {isPending ? "Guardando…" : publishing ? "Publicar" : submitLabel}
          </Button>
        </ActionBar>
      </div>
      {publish.open ? (
        <PublishPreview
          before={stored.isPublished ? stored : null}
          after={values}
          fields={EVENT_PUBLISH_FIELDS}
          render={(shown, changed, previous) => <EventPreview values={shown} changed={changed} previous={previous} />}
          {...publish.dialog}
        />
      ) : null}
    </form>
  );
}
