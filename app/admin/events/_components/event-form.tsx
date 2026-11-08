"use client";

import type { ComponentProps } from "react";

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

import { ActionBar, Field, FieldError, FormFeedback } from "../../_components/form-parts";
import { MoreOptions } from "../../_components/more-options";
import { PUBLISHED_MESSAGE, PublishPreview, usePublishFlow } from "../../_components/publish-preview";
import { useControlledForm } from "../../_components/use-controlled-form";
import { EVENT_PUBLISH_FIELDS, EventPreview } from "./event-preview";
import { RegistrationFields } from "./registration-fields";

type EventFormAction = (prevState: ActionResult | null, formData: FormData) => Promise<ActionResult>;

interface EventFormProps {
  action: EventFormAction;
  submitLabel: string;
  initialValues?: EventFormValues;
}

const TYPE_OPTIONS = [
  { value: "taller", label: "Taller" },
  { value: "charla", label: "Charla" },
  { value: "evento", label: "Evento" },
  { value: "comunidad", label: "Comunidad" },
  { value: "", label: "Sin tipo" },
] as const;

const PRECISION_OPTIONS = [
  { value: "day", label: "Fecha exacta" },
  { value: "month", label: "Solo mes" },
] as const;

/** The fields under "Más opciones": an error in one of them opens it. */
const MORE_OPTIONS_FIELDS = ["commitMessage", "hora", "lugar", "para", "linkUrl", "linkLabel", "highlights", "featured", "publishAt", "unpublishAt", "slug"] as const;

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
export function EventForm({ action, submitLabel, initialValues = EMPTY_EVENT_FORM_VALUES }: EventFormProps) {
  const { values, stored, setValues, bind, toggle, handleSubmit, review, submit, state, isPending, errors } = useControlledForm(action, initialValues, {
    serialize: formValuesToFormData,
  });
  // A published event asks first, with the preview; a draft saves as it always did.
  const publishing = values.isPublished;
  const publish = usePublishFlow({ state, review, submit });
  const isEditing = initialValues.slug !== "";

  function setDatePrecision(datePrecision: string) {
    setValues((previous) => {
      const precision = datePrecision === "month" ? "month" : "day";
      const snapped = precision === "month" && previous.date.length === 10 ? `${previous.date.slice(0, 7)}-01` : previous.date;

      return { ...previous, datePrecision: precision, date: snapped };
    });
  }

  const moreOptionsInvalid = MORE_OPTIONS_FIELDS.some((name) => errors[name]);

  return (
    <form onSubmit={publishing ? publish.ask : handleSubmit} noValidate>
      <div className="grid gap-x-4 gap-y-5 @xl:grid-cols-2">
        <Field label="Título" count={{ length: values.title.length, max: 120 }} error={errors.title} className="@xl:col-span-2">
          {(control) => <Input {...control} {...bind("title")} required maxLength={120} className="text-lg" />}
        </Field>
        <div className="grid min-w-0 content-start gap-1.5">
          <Segmented
            legend="Tipo de fecha"
            name="datePrecision"
            value={values.datePrecision}
            options={PRECISION_OPTIONS}
            columnsClassName="grid-cols-2"
            onChange={setDatePrecision}
            aria-describedby={errors.datePrecision ? "datePrecision-error" : undefined}
            aria-invalid={errors.datePrecision ? true : undefined}
          />
          {errors.datePrecision ? <FieldError id="datePrecision-error" announce={false}>{errors.datePrecision}</FieldError> : null}
        </div>
        <Field label={values.datePrecision === "month" ? "Mes" : "Fecha"} error={errors.date}>
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
        <div className="grid min-w-0 content-start gap-1.5 @xl:col-span-2">
          <Segmented
            legend="Tipo"
            name="type"
            value={values.type}
            options={TYPE_OPTIONS}
            onChange={(type) => setValues((previous) => ({ ...previous, type }))}
            aria-describedby={errors.type ? "type-error" : undefined}
            aria-invalid={errors.type ? true : undefined}
          />
          {errors.type ? <FieldError id="type-error" announce={false}>{errors.type}</FieldError> : null}
        </div>
        <Field label="Descripción" count={{ length: values.description.length, max: 600 }} error={errors.description} className="@xl:col-span-2">
          {(control) => <Textarea {...control} {...bind("description")} rows={4} maxLength={600} />}
        </Field>
        {isEditing ? null : <p className="text-sm text-mist @xl:col-span-2">Las fotos se agregan después de crear el evento.</p>}
        <RegistrationFields
          mode={values.registrationMode}
          onModeChange={(registrationMode) => setValues((previous) => ({ ...previous, registrationMode }))}
          capacity={bind("registrationCapacity")}
          deadline={bind("registrationDeadline")}
          errors={errors}
        />
        <SwitchField label="Publicado" {...toggle("isPublished")} className="@xl:col-span-2" />
        <div className="grid min-w-0 @xl:col-span-2">
          <MoreOptions invalid={moreOptionsInvalid}>
            <Field label="Mensaje de commit" count={{ length: values.commitMessage.length, max: 80 }} error={errors.commitMessage} className="@xl:col-span-2">
              {(control) => <CommitInput {...control} {...bind("commitMessage")} maxLength={80} />}
            </Field>
            <Field label="Hora" count={{ length: values.hora.length, max: 80 }} error={errors.hora}>
              {(control) => <Input {...control} {...bind("hora")} maxLength={80} />}
            </Field>
            <Field label="Lugar" count={{ length: values.lugar.length, max: 80 }} error={errors.lugar}>
              {(control) => <Input {...control} {...bind("lugar")} maxLength={80} />}
            </Field>
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
            <SwitchField label="Destacado" {...toggle("featured")} className="@xl:col-span-2" />
            <Field label="Publicar el" help="Hora de Ecuador. Vacío: sale de inmediato." error={errors.publishAt}>
              {(control) => <Input {...control} {...bind("publishAt")} type="datetime-local" />}
            </Field>
            <Field label="Retirar el" help="Hora de Ecuador. Vacío: no se retira." error={errors.unpublishAt}>
              {(control) => <Input {...control} {...bind("unpublishAt")} type="datetime-local" />}
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
        </div>
      </div>

      <ActionBar status={<FormFeedback state={state} savedMessage={stored.isPublished ? PUBLISHED_MESSAGE : undefined} />}>
        <Button type="submit" busy={isPending} aria-disabled={isPending || undefined} className="min-h-12">
          {isPending ? "Guardando…" : publishing ? "Publicar" : submitLabel}
        </Button>
      </ActionBar>
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
