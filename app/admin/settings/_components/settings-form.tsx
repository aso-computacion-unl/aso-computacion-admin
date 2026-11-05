"use client";

import { startTransition, useActionState, useEffect, useReducer, useRef, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Icon } from "@/components/icons";
import type { ActionResult } from "@/interface/admin/action-result";
import { SETTINGS_FIELD_MESSAGES } from "@/interface/admin/field-messages";
import { toFormData } from "@/interface/admin/form-fields";
import {
  createSettingsEditorState,
  hasUnsavedChanges,
  settingsEditorReducer,
  type SettingsValues,
} from "@/interface/admin/settings/settings-editor-state";

import { ActionBar, Field, FormFeedback } from "../../_components/form-parts";
import { FormColumns, Panel, StickyAside } from "../../_components/form-layout";
import { collectFieldErrors, useFocusFirstInvalid } from "../../_components/use-controlled-form";
import { SettingsPreview } from "./settings-preview";
import { SettingsReadView } from "./settings-read-view";

export type SettingsFormValues = SettingsValues;

export const EMPTY_SETTINGS_FORM_VALUES: SettingsFormValues = { tagline: "", description: "", about: "" };

interface SettingsFormProps {
  action: (prevState: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  initialValues?: SettingsFormValues;
}

const PUBLISH_NOTE = "Los cambios llegan al sitio público en su próxima actualización.";

/**
 * Shows the saved texts and opens the fields only on "Editar". The draft lives here (not in the
 * fields) so the preview in the right column follows every keystroke; the form is submitted by hand
 * through `startTransition`, so a failed save keeps what was typed.
 */
export function SettingsForm({ action, initialValues = EMPTY_SETTINGS_FORM_VALUES }: SettingsFormProps) {
  const [state, dispatch] = useReducer(settingsEditorReducer, initialValues, createSettingsEditorState);
  const [, formAction, isPending] = useActionState(async (previous: ActionResult | null, formData: FormData) => {
    const result = await action(previous, formData);

    dispatch({ type: "result", result });

    return result;
  }, null);
  const editing = state.mode === "edit";
  const dirty = hasUnsavedChanges(state);
  const errors = state.result?.fieldErrors ?? {};
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const previousMode = useRef(state.mode);
  const formRef = useRef<HTMLFormElement>(null);

  useFocusFirstInvalid(state.result, formRef);

  // Focus follows the mode: first field on "Editar", back to "Editar" on cancel or after saving.
  useEffect(() => {
    if (previousMode.current === state.mode) return;

    previousMode.current = state.mode;
    (editing ? firstFieldRef : editButtonRef).current?.focus();
  }, [editing, state.mode]);

  useEffect(() => {
    if (!dirty) return;

    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", warn);

    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending) return;

    // Every field the browser's own constraints reject shows at once, with the texts the server would use.
    const fieldErrors = collectFieldErrors(event.currentTarget, SETTINGS_FIELD_MESSAGES);

    if (Object.keys(fieldErrors).length > 0) {
      dispatch({ type: "result", result: { fieldErrors } });
      return;
    }

    startTransition(() => formAction(toFormData({ ...state.draft })));
  }

  function field(name: keyof SettingsValues) {
    return {
      name,
      value: state.draft[name],
      readOnly: isPending,
      onChange: (event: { target: { value: string } }) => dispatch({ type: "change", field: name, value: event.target.value }),
    };
  }

  return (
    <FormColumns stickyAside aside={
        <StickyAside>
          <SettingsPreview values={state.draft} editing={editing} />
        </StickyAside>
      }>
      <Panel aria-label="Textos del sitio">
        {editing ? (
          <form ref={formRef} onSubmit={handleSubmit} noValidate className="grid gap-5">
            <Field label="Lema" hint="Hasta 120 caracteres." error={errors.tagline}>
              {(control) => <Input {...control} {...field("tagline")} ref={firstFieldRef} required maxLength={120} />}
            </Field>
            <Field label="Descripción" hint="Resumen corto del sitio. Hasta 300 caracteres." error={errors.description}>
              {(control) => <Textarea {...control} {...field("description")} rows={3} required maxLength={300} />}
            </Field>
            <Field label="Acerca de" hint="Hasta 600 caracteres." error={errors.about}>
              {(control) => <Textarea {...control} {...field("about")} rows={8} required maxLength={600} />}
            </Field>
            <p className="text-[0.8125rem] text-mist">{PUBLISH_NOTE}</p>
            <ActionBar status={<FormFeedback state={state.result} />}>
              <Button type="submit" busy={isPending} aria-disabled={isPending || undefined} className="min-h-12">
                {isPending ? "Guardando…" : "Guardar cambios"}
              </Button>
              <Button
                type="button"
                variant="line"
                aria-disabled={isPending || undefined}
                onClick={() => !isPending && dispatch({ type: "cancel" })}
                className="min-h-12"
              >
                Cancelar
              </Button>
            </ActionBar>
          </form>
        ) : (
          <div className="grid gap-5">
            <SettingsReadView values={state.saved} />
            <p className="text-[0.8125rem] text-mist">{PUBLISH_NOTE}</p>
            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
              <FormFeedback state={state.result} />
              <Button ref={editButtonRef} variant="line" onClick={() => dispatch({ type: "edit" })}>
                <Icon name="edit" className="size-4" />
                Editar
              </Button>
            </div>
          </div>
        )}
      </Panel>
    </FormColumns>
  );
}
