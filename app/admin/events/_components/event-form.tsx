"use client";

import { startTransition, useActionState, useId, useState, type FormEvent, type ReactNode } from "react";

import type { ActionResult } from "@/interface/admin/action-result";
import {
  EMPTY_EVENT_FORM_VALUES,
  formValuesToFormData,
  type EventFormValues,
} from "@/interface/admin/events/event-form-values";

type EventFormAction = (prevState: ActionResult | null, formData: FormData) => Promise<ActionResult>;

interface EventFormProps {
  action: EventFormAction;
  submitLabel: string;
  initialValues?: EventFormValues;
}

interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  children: (control: { id: string; "aria-describedby"?: string; "aria-invalid"?: true }) => ReactNode;
}

function Field({ label, hint, error, children }: FieldProps) {
  const id = useId();
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;

  return (
    <p className="field">
      <label htmlFor={id}>{label}</label>
      {children({ id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined })}
      {hint ? (
        <small id={`${id}-hint`} className="field-hint">
          {hint}
        </small>
      ) : null}
      {error ? (
        <small id={`${id}-error`} className="field-error" role="alert">
          {error}
        </small>
      ) : null}
    </p>
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
      <fieldset>
        <legend>Datos del evento</legend>
        <Field label="Título" error={errors.title}>
          {(control) => <input {...control} {...bind("title")} required maxLength={120} />}
        </Field>
        <Field
          label="Identificador (slug)"
          hint={isEditing ? "Cambiarlo cambia el enlace público del evento." : "Déjelo vacío para generarlo desde el título."}
          error={errors.slug}
        >
          {(control) => <input {...control} {...bind("slug")} maxLength={80} />}
        </Field>
        <Field label="Descripción" hint="Hasta 600 caracteres." error={errors.description}>
          {(control) => <textarea {...control} {...bind("description")} rows={4} maxLength={600} />}
        </Field>
        <Field
          label="Fecha"
          hint="Una fecha futura se muestra como próximo evento; una pasada, como historial."
          error={errors.date}
        >
          {(control) => <input {...control} {...bind("date")} type="date" />}
        </Field>
        <Field label="Tipo" error={errors.type}>
          {(control) => (
            <select {...control} {...bind("type")}>
              <option value="">Sin tipo</option>
              <option value="taller">Taller</option>
              <option value="charla">Charla</option>
              <option value="evento">Evento</option>
              <option value="comunidad">Comunidad</option>
            </select>
          )}
        </Field>
        <Field
          label="Mensaje de commit"
          hint="Línea corta en tono de broma, por ejemplo: feat: hackatón 24h"
          error={errors.commitMessage}
        >
          {(control) => <input {...control} {...bind("commitMessage")} maxLength={80} />}
        </Field>
      </fieldset>

      <fieldset>
        <legend>Detalles prácticos (opcionales)</legend>
        <Field label="Hora" error={errors.hora}>
          {(control) => <input {...control} {...bind("hora")} maxLength={80} />}
        </Field>
        <Field label="Lugar" error={errors.lugar}>
          {(control) => <input {...control} {...bind("lugar")} maxLength={80} />}
        </Field>
        <Field label="Para quién" error={errors.para}>
          {(control) => <input {...control} {...bind("para")} maxLength={80} />}
        </Field>
        <Field label="Enlace" hint="Solo https://" error={errors.linkUrl}>
          {(control) => <input {...control} {...bind("linkUrl")} type="url" inputMode="url" />}
        </Field>
        <Field label="Texto del enlace" error={errors.linkLabel}>
          {(control) => <input {...control} {...bind("linkLabel")} maxLength={80} />}
        </Field>
        <Field
          label="Puntos destacados"
          hint="Uno por línea, hasta 8 de 80 caracteres. Se muestran en el orden indicado."
          error={errors.highlights}
        >
          {(control) => <textarea {...control} {...bind("highlights")} rows={4} />}
        </Field>
      </fieldset>

      <fieldset>
        <legend>Publicación</legend>
        <p className="field">
          <label>
            <input type="checkbox" {...toggle("featured")} /> Destacado (foto grande en el sitio)
          </label>
        </p>
        <p className="field">
          <label>
            <input type="checkbox" {...toggle("isPublished")} /> Publicado
          </label>
          <small className="field-hint">
            Los borradores no salen en el sitio. Los cambios llegan al sitio público en su próxima actualización.
          </small>
        </p>
      </fieldset>

      <div aria-live="polite">
        {state?.error ? <p role="alert" className="field-error">{state.error}</p> : null}
        {state?.success ? <p role="status">Cambios guardados.</p> : null}
      </div>
      <button type="submit" aria-disabled={isPending || undefined}>
        {isPending ? "Guardando..." : submitLabel}
      </button>
    </form>
  );
}
