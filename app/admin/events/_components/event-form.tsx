"use client";

import { startTransition, useActionState, useState, type ComponentProps, type FormEvent } from "react";

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

import { ActionBar, Field, FieldError, FormFeedback, FormSection } from "../../_components/form-parts";

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
 * form action).
 */
export function EventForm({ action, submitLabel, initialValues = EMPTY_EVENT_FORM_VALUES }: EventFormProps) {
  const [values, setValues] = useState<EventFormValues>(initialValues);
  const [state, formAction, isPending] = useActionState(action, null);
  const isEditing = initialValues.slug !== "";

  function bind<K extends keyof EventFormValues>(key: K) {
    return {
      name: key,
      value: values[key] as string,
      onChange: (event: { target: { value: string } }) => setValues((previous) => ({ ...previous, [key]: event.target.value })),
    };
  }

  function setDatePrecision(datePrecision: string) {
    setValues((previous) => {
      const precision = datePrecision === "month" ? "month" : "day";
      const snapped = precision === "month" && previous.date.length === 10 ? `${previous.date.slice(0, 7)}-01` : previous.date;

      return { ...previous, datePrecision: precision, date: snapped };
    });
  }

  function toggle(key: "featured" | "isPublished") {
    return {
      name: key,
      checked: values[key],
      onChange: () => setValues((previous) => ({ ...previous, [key]: !previous[key] })),
    };
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending) return;

    startTransition(() => formAction(formValuesToFormData(values)));
  }

  const errors = state?.fieldErrors ?? {};

  return (
    <form onSubmit={handleSubmit} noValidate>
      <FormSection legend="Datos del evento">
        <Field label="Título" error={errors.title} className="md:col-span-2">
          {(control) => <Input {...control} {...bind("title")} required maxLength={120} />}
        </Field>
        <Field
          label="Mensaje de commit"
          hint="Línea corta en tono de broma, por ejemplo: feat: hackatón 24h"
          error={errors.commitMessage}
          className="md:col-span-2"
        >
          {(control) => <CommitInput {...control} {...bind("commitMessage")} maxLength={80} />}
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
          {errors.datePrecision ? <FieldError id="datePrecision-error">{errors.datePrecision}</FieldError> : null}
        </div>
        <Field
          label={values.datePrecision === "month" ? "Mes" : "Fecha"}
          hint={
            values.datePrecision === "month"
              ? "Para cuando aún no hay día confirmado: el sitio muestra solo el mes, por ejemplo feb 2026."
              : "Una fecha futura se muestra como próximo evento; una pasada, como historial."
          }
          error={errors.date}
        >
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
        <Field
          label="Identificador (slug)"
          hint={isEditing ? "Cambiarlo cambia el enlace público del evento." : "Déjelo vacío para generarlo desde el título."}
          error={errors.slug}
        >
          {(control) => <Input {...control} {...bind("slug")} maxLength={80} />}
        </Field>
        <div className="grid min-w-0 content-start gap-1.5 md:col-span-2">
          <Segmented
            legend="Tipo"
            name="type"
            value={values.type}
            options={TYPE_OPTIONS}
            onChange={(type) => setValues((previous) => ({ ...previous, type }))}
            aria-describedby={errors.type ? "type-error" : undefined}
            aria-invalid={errors.type ? true : undefined}
          />
          {errors.type ? <FieldError id="type-error">{errors.type}</FieldError> : null}
        </div>
        <Field label="Descripción" hint="Hasta 600 caracteres." error={errors.description} className="md:col-span-2">
          {(control) => <Textarea {...control} {...bind("description")} rows={4} maxLength={600} />}
        </Field>
      </FormSection>

      <FormSection legend="Detalles prácticos (opcionales)" className="md:grid-cols-3">
        <Field label="Hora" error={errors.hora}>
          {(control) => <Input {...control} {...bind("hora")} maxLength={80} />}
        </Field>
        <Field label="Lugar" error={errors.lugar}>
          {(control) => <Input {...control} {...bind("lugar")} maxLength={80} />}
        </Field>
        <Field label="Para quién" error={errors.para}>
          {(control) => <Input {...control} {...bind("para")} maxLength={80} />}
        </Field>
        <Field label="Enlace" hint="Solo https://" error={errors.linkUrl} className="md:col-span-2">
          {(control) => <Input {...control} {...bind("linkUrl")} type="url" inputMode="url" />}
        </Field>
        <Field label="Texto del enlace" error={errors.linkLabel}>
          {(control) => <Input {...control} {...bind("linkLabel")} maxLength={80} />}
        </Field>
        <Field
          label="Puntos destacados"
          hint="Uno por línea, hasta 8 de 80 caracteres. Se muestran en el orden indicado."
          error={errors.highlights}
          className="md:col-span-3"
        >
          {(control) => <Textarea {...control} {...bind("highlights")} rows={4} />}
        </Field>
      </FormSection>

      <FormSection legend="Publicación" className="gap-y-1 md:grid-cols-1">
        <SwitchField label="Destacado" description="Foto grande en el sitio." {...toggle("featured")} />
        <SwitchField
          label="Publicado"
          description="Los borradores no salen en el sitio. Los cambios llegan al sitio público en su próxima actualización."
          {...toggle("isPublished")}
        />
      </FormSection>

      <ActionBar status={<FormFeedback state={state} />}>
        <Button type="submit" busy={isPending} aria-disabled={isPending || undefined} className="min-h-12">
          {isPending ? "Guardando…" : submitLabel}
        </Button>
      </ActionBar>
    </form>
  );
}
